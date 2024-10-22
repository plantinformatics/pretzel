
import { chrData, cmNameAdd } from './utility-chromosome';
import { breakPoint } from './breakPoint';

/*----------------------------------------------------------------------------*/

const trace_feature = 1;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/* split out of components/goto-feature.js : 
 * featureChrs(),  name2Map(),  chrMap(),  objectSet(),   reduce_addToSet(),  mapsOfFeature()
 * (considered also  models/chromosome, utils/utility-chromosome.js)
 * could split out objectSet() to utils
 */

/*----------------------------------------------------------------------------*/


  /** @return array of names of chromosomes containing feature */
function featureChrs(oa, featureName)
  {
    let c;
    // featureAxisSets may not have been initialised ?
    if (oa && oa.featureAxisSets && oa.featureAxisSets[featureName])
      // featureAxisSets is a hash of Sets
      c = Array.from(oa.featureAxisSets[featureName].keys());
    else
      c = [];
    return c;
  }

  /** Lookup the given map name in the current store.   Uses peek not find - does
   * not load from back-end.
   * @return map object refn, or undefined if not found
   */
  function name2Map(store, mapName)
  {
    console.log('name2Map', store, mapName, store.peekAll('dataset').length);
    let
      maps=store
      .peekAll('geneticmap')
      .filter(function (a) { return a.get('name') == mapName;}),
    /** expect a.length == 1  */
    map = maps.length > 0 ? maps[0] : undefined;
    return map;
  }

  /** @return map containing named chromosome */
function chrMap(store, oa, chrName)
  {
    let
      chr = oa && oa.stacks.blocks[chrName], blockR = chr.block, map;
    if (chr && blockR)
      map = blockR.mapName || blockR.get('datasetId').get('id');
    else
    {
      let stacked = oa.axes[chrName];
      if (stacked === undefined)
      {
        breakPoint('chrMap() : stacked undefined for', chrName);
      }
      else
      /* Convert map name to object refn, for uniform result object type,
       * because other branch returns map object refn .
       */
      map  =  name2Map(store, stacked.mapName);
      console.log("goto-feature chrMap()", oa, oa.axes, chrName, stacked, map);
    }
    return map;
  }

  /*----------------------------------------------------------------------------*/

  /** Convert the given array of object references into a Set,
   * thereby determining the unique references.
   * The caller may convert back to an array, with Array.from(result.keys())
  */
  function objectSet(objArray)
  {
    function reduce_addToSet(accumulator, currentValue/*, currentIndex, array*/)
    {
      return accumulator.add(currentValue);
    }
    let s = objArray.reduce(reduce_addToSet, new Set());
    return s;
  }

  /*----------------------------------------------------------------------------*/

function mapsOfFeature(store, oa, featureName) {
    let
      chrNames;    
    if (oa && featureName)
    {
      chrNames = featureChrs.apply(this, [oa, featureName]);
      // console.log(featureName, "chrNames", chrNames);
    }
    else
    {
      return [];  // because oa is needed by featureChrs() and chrMap()
    }
    let
    axesParents = chrNames.map(function (chrName) {
      let map = chrMap(store, oa, chrName);
      return map;
    }),
    uniqueAxes = objectSet(axesParents),
    axes = Array.from(uniqueAxes.keys());
    console.log("mapsOfFeature", featureName, chrNames, axesParents, uniqueAxes, axes);
    return axes;
  }

/*----------------------------------------------------------------------------*/

/** store the given feature.
 * @param feature name of feature (ID)
 * @param f feature record
 * @param axisID if not undefined, add feature to z[axisID], which has already been done above,
 * but not when called from paths-progressive.
 */
function storeFeature(oa, flowsService, feature, f, axisID) {
  /* Populate the draw-map data structures, which will mostly be progressively
   * replaced by CPs based on store data.
   */
  if (! oa.z[axisID]) {
    let block = f.get('blockId.content');
    cmNameAdd(oa, block);
    if (! oa.z[axisID] ) {
      // this covers the required part of receivedBlock2()
      oa.z[axisID] = chrData(block);
      dLog('storeFeature', axisID, oa.z[axisID]);
    }
  }
  storeFeature2(oa, flowsService, feature, f, axisID);
}
/** Same params as storeFeature().
 */
function storeFeature2(oa, flowsService, feature, f, axisID) {
  if (axisID && ! oa.z[axisID][feature]) {
    /* when called from paths-progressive, emulate the data structure created by
     * chrData() / receiveChr()
     */
    if (trace_feature > 1)
      console.log('storeFeature', arguments);

    /* until 1140ecbc, feature.location was calculated here based on .value_0 or .value[].
     * Not required now because it is done by models/feature.js : get location(), since b919b947.
     */

    // f.aliases = [];
    // f.id is already set.
    if (trace_feature > 1)
      console.log('storeFeature', axisID, feature, f.id, f, oa.z[axisID]);

    oa.z[axisID][feature] = f;
  }
  /* can factor out the part of ensureFeatureIndex() after let f =, and pass f
   * in from here, or better : make f an optional arg, and move the isOtherField
   * check out to the other caller - featureLookupName()
   * can also pass oa in from here.
   * import { ensureFeatureIndex } from './draw/collate-paths';
  if (axisID !== f.get('blockId.id'))
    console.log(axisID, '!==', f.get('blockId.id'));
  ensureFeatureIndex(f.id, feature, axisID);
   */
  oa.d3FeatureSet.add(feature);
  flowsService.d3Features.push(feature);
  oa.featureIndex[f.id] = f;
}

import { stacks, Stacked } from './stacks';

/** called when z[axisID] does not contain [d].
 * Lookup feature d, and add it to z[axisID].
 * @param featureName name of feature (ID)
 */
function lookupFeature(oa, flowsService, z, axisID, featureName) {
  let 
    axis = Stacked.getAxis(axisID),
  index = axis.blocks.findIndex((b) => b.axisName === axisID),
  features = axis.blocks[index].block.get('features'),
  feature = features.find((f) => f.get('name') === featureName);
  storeFeature2(oa, flowsService, featureName, feature, axisID);
  return feature;
}


/*----------------------------------------------------------------------------*/

/** @param features contains the data attributes of the features.
 */
function ensureBlockFeatures(blockId, features) {
  // may also need ensureFeatureIndex().
  let
    /** oa.z could be passed in as a parameter, but this will be replaced anyway.  */
    oa = stacks.oa,
  za = oa.z[blockId];
  /* if za has not been populated with features, it will have just .dataset
   * and .scope, i.e. .length === 2 */
  if (Object.keys(za).length == 2) {
    dLog('ensureBlockFeatures()', blockId, za, features);
    // add features to za.
    features.forEach((f) => za[f.name] = f.value);
  }
}

/*----------------------------------------------------------------------------*/

export { featureChrs,  name2Map,   chrMap, objectSet,  mapsOfFeature, storeFeature, lookupFeature, ensureBlockFeatures };
