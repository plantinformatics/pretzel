import { breakPoint } from '../utils/breakPoint';

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

export { featureChrs,  name2Map,   chrMap, objectSet,  mapsOfFeature };
