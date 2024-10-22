
/* lookup path-data on owner, so that it has owner, instead of :
import PathData from '../components/draw/path-data';
*/
import { featureNameClass } from './draw/stacksAxes';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/


if (false) {
  /** Example of param paths passed to draw() above. */
  const examplePaths = 
[{"_id":{"name":"myMarkerC"},
  "alignment":[
      {"blockId":"5c75d4f8792ccb326827daa2","repeats":{
	  "_id":{"name":"myMarkerC","blockId":"5c75d4f8792ccb326827daa2"},
	  "features":[{"_id":"5c75d4f8792ccb326827daa6","name":"myMarkerC","value":[3.1,3.1],"blockId":"5c75d4f8792ccb326827daa2","parentId":null}],"count":1}},
      {"blockId":"5c75d4f8792ccb326827daa1","repeats":{
	  "_id":{"name":"myMarkerC","blockId":"5c75d4f8792ccb326827daa1"},
	      "features":[{"_id":"5c75d4f8792ccb326827daa5","name":"myMarkerC","value":[0,0],"blockId":"5c75d4f8792ccb326827daa1","parentId":null}],"count":1}}]}];
}


/*----------------------------------------------------------------------------*/

function featureEltId(featureBlock)
{
  let id = featurePathKeyFn(featureBlock);
  id = featureNameClass(id);
  return id;
}

function featurePathKeyFn (featureBlock)
{ return featureBlock._id.name; }

/** @return a function to translate the given type of paths result into
 * syntenyBlocks
 * @desc based on pathsOfFeature().
 */
function syntenyBlocksOfFeature(pathsResultType) {
  return function (feature) {
    let blocksFeatures =
      [0, 1].map(function (blockIndex) { return pathsResultType.blocksFeatures(feature, blockIndex); }),
    blocks = resultBlockIds(pathsResultType, feature),
    pairs = 
      blocksFeatures[0].reduce(function (result, f0) {
        let result1 = blocksFeatures[1].reduce(function (result, f1) {
          let syntenyBlock =
            [f0, f1, blocks[0], blocks[1]];
          result.push(syntenyBlock);
          return result;
        }, result);
        return result1;
      }, []);
    return pairs;
  };
}


/** Given the grouped data for a feature, from the pathsDirect() result,
 * generate the cross-product feature.alignment[0].repeats X feature.alignment[1].repeats.
 * The result is an array of pairs of features;  each pair defines a path and is of type PathData.
 * for each pair an element of pairs[] :
 *   pair.feature0 is in block pair.block0
 *   pair.feature1 is in block pair.block1
 *    (for the case of pathsResultTypes.direct) :
 *   pair.block0 === feature.alignment[0].blockId
 *   pair.block1 === feature.alignment[1].blockId
 * i.e. the path goes from the first block in the request params to the 2nd block
 * @param pathsResultType e.g. pathsResultTypes.{Direct,Aliases}
 * @param feature 1 element of the result array passed to draw()
 * @return [PathData, ...]
 */
function pathsOfFeature(store, pathsResultType, owner) {
  const PathData = owner.factoryFor('component:draw/path-data');
  return function (feature) {
    let blocksFeatures =
      [0, 1].map(function (blockIndex) { return pathsResultType.blocksFeatures(feature, blockIndex); }),
    blocks = resultBlockIds(pathsResultType, feature),
    pairs = 
      blocksFeatures[0].reduce(function (result, f0) {
        let result1 = blocksFeatures[1].reduce(function (result, f1) {
          let pair =
            pathCreate(owner, store, f0, f1, blocks[0], blocks[1]);
          result.push(pair);
          return result;
        }, result);
        return result1;
      }, []);
    return pairs;
  };
}

const trace_pc = 1;

function pathCreate(owner, store, feature0, feature1, block0, block1) {
  const PathData = owner.factoryFor('component:draw/path-data');
  let
    /** not used - same as feature{0,1}.blockId. */
    block0r = store.peekRecord('block', block0),
    block1r = store.peekRecord('block', block1);
  if (true) {
  let properties = {
	  feature0,
    feature1/*,
    block0r,
    block1r*/
  },
    pair =
      PathData.create({ renderer : {} });
    pair.setProperties(properties);
    if (trace_pc > 2)
      dLog('PathData.create()', PathData, pair);
    return pair;
  }
  else {
    let
      modelName = 'draw/path-data',
    idText = locationPairKeyFn({ feature0, feature1}),
    r = store.peekRecord(modelName, idText);
    if (r)
      dLog('pathCreate', feature0, feature1, block0, block1, r.id);
    else if (false)
    {
      let data = {
        type : modelName,
        id : idText,
        relationships : {
          feature0 : { data: { type: "feature", "id": feature0 } },
          feature1 : { data: { type: "feature", "id": feature1 } } /*,
          block0 : { data: { type: "block", "id": block0r } },
          block1 : { data: { type: "block", "id": block1r } }*/
        }/*,
        attributes : {
          'block-id0' : block0,
          'block-id1' : block1
        }*/
      };
      r = store.push({data});
      if (trace_pc)
        dLog('pathCreate', r, r.get('id'), r.id, store, data);
    }
    else {
      let inputProperties = {
	      feature0,
        feature1/*,
        block0r,
        block1r*/
      };
      r = store.createRecord(modelName, inputProperties);
    }
    return r;
  }
}


function locationPairKeyFn(locationPair)
{
  return locationPair.feature0.id + '_' + locationPair.feature1.id;
}

/*----------------------------------------------------------------------------*/

const pathsApiFields = ['featureAObj', 'featureBObj'];
/** This type is created by paths-progressive.js : requestAliases() : receivedData() */
const pathsApiResultType = {
  // fieldName may be pathsResult or pathsAliasesResult
  typeCheck : function(resultElt, trace) { let ok = !! resultElt.featureAObj; if (! ok && trace) {
    dLog('pathsApiResultType : typeCheck', resultElt); };  return ok;  },
  pathBlock :  function (resultElt, blockIndex) {
    let blockId = resultElt[pathsApiFields[blockIndex]].blockId;
    /** at this point blockId may be a fulfilled Promise Proxy; if so get the .id  */
    if (blockId.content) {
      blockId = blockId.get('id');
    }
    return blockId;
  },
  /** direct.blocksFeatures() returns an array of features, so match that. See
   * similar commment in alias.blocksFeatures. */
  blocksFeatures : function (resultElt, blockIndex) { return [ resultElt[pathsApiFields[blockIndex]] ]; },
  featureEltId :
    function (resultElt)
    {
      let id = pathsApiResultType.featurePathKeyFn(resultElt);
      id = featureNameClass(id);
      return id;
    },
  featurePathKeyFn : function (resultElt) { return resultElt.featureA + '_' + resultElt.featureB; }

};

/** This is provision for using the API result type as <path> data type; not used currently because
 * the various forms of result data are converted to path-data.
 * These are the result types from :
 * Block/paths -> apiLookupAliases() ->  task.paths() 
 * Blocks/pathsViaStream  -> pathsAggr.pathsDirect() 
 * getPathsAliasesViaStream() / getPathsAliasesProgressive() -> Blocks/pathsAliasesProgressive -> dbLookupAliases() -> pathsAggr.pathsAliases()
 */
const pathsResultTypes = {
  direct : {
    typeName : 'direct',
    fieldName : 'pathsResult',
    typeCheck : function(resultElt, trace) { let ok = !! resultElt._id; if (! ok && trace) {
      dLog('direct : typeCheck', resultElt); }; return ok; },
    pathBlock :  function (resultElt, blockIndex) { return resultElt.alignment[blockIndex].blockId; },
    blocksFeatures : function (resultElt, blockIndex) { return resultElt.alignment[blockIndex].repeats.features; },
    featureEltId : featureEltId,
    featurePathKeyFn : featurePathKeyFn
  },

  alias :
  {
    typeName : 'alias',
    fieldName : 'pathsAliasesResult',
    typeCheck : function(resultElt, trace) { let ok = !! resultElt.aliased_features;  if (! ok && trace) {
      dLog('alias : typeCheck', resultElt); }; return ok; },
    pathBlock :  function (resultElt, blockIndex) { return resultElt.aliased_features[blockIndex].blockId; },
    /** There is currently only 1 element in .aliased_features[blockIndex], but
     * pathsOfFeature() handles an array an produces a cross-product, so return
     * this 1 element as an array. */
    blocksFeatures : function (resultElt, blockIndex) { return [resultElt.aliased_features[blockIndex]]; },
    featureEltId :
    function (resultElt)
    {
      let id = pathsResultTypes.alias.featurePathKeyFn(resultElt);
      id = featureNameClass(id);
      return id;
    },
    featurePathKeyFn : function (resultElt) {
      return resultElt.aliased_features.map(function (f) { return f.name; } ).join('_');
    }
  }
},
/** This matches the index values of services/data/flows-collate.js : flows */
flowNames = Object.keys(pathsResultTypes);
// add .flowName to each of pathsResultTypes, which could later require non-const declaration.
flowNames.forEach(function (flowName) { pathsResultTypes[flowName].flowName = flowName; } );

pathsResultTypes.pathsApiResult = pathsApiResultType;

/** Lookup the pathsResultType, given pathsResultField and optional resultElt.
 *
 * When matching each candidate pathsResultType (prt) :
 * prt.fieldName is checked if it is defined.
 * prt.typeCheck() is checked if resultElt is given.
 */
function pathsResultTypeFor(pathsResultField, resultElt) {
  let pathsResultType =
    Object.values(pathsResultTypes).find(
      (prt) => (! prt.fieldName || (prt.fieldName === pathsResultField)) && (!resultElt || prt.typeCheck(resultElt, false)));
  return pathsResultType;
}


/**
 * @return	array[2] of blockId, equivalent to blockAdjId  
 */
function resultBlockIds(pathsResultType, featurePath) {
  let blockIds =
    [0, 1].map(function (blockIndex) { return pathsResultType.pathBlock(featurePath, blockIndex); });
  return blockIds;
}

/** Return an accessor function suited to the object type of feature.
 */
function featureGetFn(feature) {
  let fn =
    feature.get ? (field) => feature.get(field) : (field) => feature[field];
  return fn;
}

/** Used to get the block of a feature in pathsApiResultType (aliases).
 */
function featureGetBlock(feature, blocksById) {
  let
  block1 = featureGetFn(feature)('blockId'),
  block2 = block1.content || block1,
  block = block2.get ? block2 : blocksById[block2];
  return block;
}


export  {
  pathsResultTypes, pathsApiResultType, flowNames, pathsResultTypeFor, resultBlockIds,
  syntenyBlocksOfFeature,
  pathsOfFeature, locationPairKeyFn, featureGetFn, featureGetBlock
};
