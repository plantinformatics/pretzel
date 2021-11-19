'use strict';

var acl = require('../utilities/acl');

var { ontologyGetTree } = require('../utilities/get-ontology');

/* global process */
/* global require */
/* global module */

const cacheLibraryName = '../utilities/results-cache'; // or 'memory-cache' (same API)
var cache = require(cacheLibraryName);

/*----------------------------------------------------------------------------*/

const trace = 1;

/*----------------------------------------------------------------------------*/


module.exports = function(Ontology) {

  /*--------------------------------------------------------------------------*/

  /**
   * @param root  root ID of an Ontology  e.g. "CO_321" (CropOntology)
   */
  Ontology.getTree = function (root, cb) {
    const
    fnName = 'getTree',
    /** param root (or species name) will be added, to support other species.  */
    paramError = ! root.match(/^CO_[0-9]{3}$/),
    cacheId = fnName + '_' + root,
    /** define refreshCache true to replace the cached result. */
    refreshCache = false;
    let result = ! refreshCache && cache.get(cacheId);
    if (! result) {
      let cacheIdOld = fnName + root;
      result = cache.get(cacheIdOld);
      if (result) {
        console.log(fnName, 'copy result from', cacheIdOld, 'to', cacheId);
        cache.put(cacheId, result);
      }
    }
    if (paramError) {
      cb(paramError);
    } else
      if (result) {
        if (trace > 1) {
          console.log(fnName, root, cacheId, 'get', result[0] || result);
        }
        cb(null, result);
      } else {
        let
        ontologyTreeP = ontologyGetTree(root);
        ontologyTreeP.then((ontologyTree) => {
          console.log(fnName, ontologyTree);
          if (trace /*> 1*/) {
            console.log(fnName, root, cacheId, 'put', ontologyTree);
          }
          cache.put(cacheId, ontologyTree);
          cb(null, ontologyTree);
        })
        // signature of .catch() error function matches cb : (err)
          .catch(cb);
      }
  };

  /*--------------------------------------------------------------------------*/

  Ontology.remoteMethod('getTree', {
    accepts: [
      {arg: 'rootId', type: 'string', required: true},
    ],
    returns: {type: 'array', root: true},
    description: "Request ontology tree of Ontology API source"
  });

  /*--------------------------------------------------------------------------*/

  acl.assignRulesRecord(Ontology);

  Ontology.disableRemoteMethodByName("findById");

};

