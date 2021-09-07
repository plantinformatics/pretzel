'use strict';


/* global require */
/* global exports */

/*----------------------------------------------------------------------------*/

const trace = 1;

/*----------------------------------------------------------------------------*/


/** If the Dataset has tag QTL, check the Features of its Blocks :
 * if they define .values.flankingMarkers [], at least 1 of the Feature names it
 * contains should be defined in the corresponding Block of the parent Dataset.

 * @return promise yielding : undefined if OK, or otherwise an error message string for display to
 * the user in the frontend GUI
 */
exports.datasetParentContainsNamedFeatures = function(models, dataset, options, cb) {
  const fnName = 'datasetParentContainsNamedFeatures';
  let errorMsgP;
  if (! dataset.tags || (dataset.tags.indexOf('QTL') == -1) || ! dataset.parent) {
    errorMsgP = Promise.resolve(null);
  } else {
    errorMsgP = 
    datasetParent(models, dataset, options, cb)
      .then((parents) => {
        /** promise yields first errorMsg found for this dataset. */
        let errorMsgPDataset;
        let parent = parents[0];
        let blockOKPs = parent && dataset.blocks.map((block) => {
          let
          errorMsg,
          parentBlock = parent.blocks().find((b) => b.scope === block.scope),
          /** featuresP yields undefined, or the first errorMsg.
           * parentBlock.id is an ObjectID, i.e. ObjectID {_bsontype: "ObjectID", id: Buffer(12)}
           * options contains .accessToken, .userId, allowing access to user's datasets.
           */
          featuresP = models.Feature.find({where : {blockId : parentBlock.id}}, options)
            .then((parentBlockFeatures) => {
              let
              okB = block.features.every((f) => {
                let
                okF = true,
                fms = f.values && f.values.flankingMarkers;
                if (fms) {
                  let
                  okFMs = fms && parentBlockFeatures.filter((f) => (fms.indexOf(f.name) >= 0));
                  okF = okFMs.length > 0;
                  if (! okF) {
                    errorMsg = 'Block ' + block.name + ' Feature ' + f.name + ' Flanking Markers ' + fms.join(',') + ' are not in parent ' + dataset.parent + ' scope ' + block.scope;
                    if (trace) { console.log(fnName, errorMsg); }
                  } else if (trace) {
                    console.log(fnName, f.name, fms, okFMs.length);
                    if (trace > 1) {
                      okFMs.forEach((f) => console.log(JSON.stringify(f)));
                    }
                  }
                }
                return okF;
              });
              return okB ? undefined : errorMsg;
            })
            .catch(cb);
          return featuresP;
        });
        errorMsgPDataset = Promise.all(blockOKPs)
          .then((ems) => ems.find((em) => em))
          .catch(cb);
        return errorMsgPDataset;
      })
      .catch(cb);
  }
  return errorMsgP;
};

/** Lookup the dataset whose name matches dataset.parent.
 * Include blocks.
 * @return promise, yielding undefined if dataset.parent is not defined, or no match
 */
function datasetParent(models, dataset, options, cb) {
  let resultP = 
      models.Dataset.find({where : {_id : dataset.parent}, include: "blocks"}, options);
  return resultP;
}
exports.datasetParent = datasetParent;

/*----------------------------------------------------------------------------*/
