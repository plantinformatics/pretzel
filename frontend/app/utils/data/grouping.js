/*----------------------------------------------------------------------------*/

/* global d3 */

/*----------------------------------------------------------------------------*/

const trace_values = 0;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/* related : utils/data/block-values.js */

/*----------------------------------------------------------------------------*/

/** Given an array [ { block, Traits: [ "DSB", ...]}, ...]
 * Group the blocks by Trait
 * @param fieldName 'Traits', 'Ontologies', etc.
 */
function blocksValuesUnwindAndGroup(blocksTraits, fieldName) {
  let
  byTrait = 
    blocksTraits.reduce((result, blockTraits) => {
      blockTraits[fieldName].forEach((trait) => {
        (result[trait] ||= []).push(blockTraits.block);
      });
      return result;
    }, {});
  return byTrait;
}

/** Given an array [ { block, Traits: [ "DSB", ...]}, ...]
 * Group the blocks by : Trait / block.datasetId.parentName / block.scope
 * Trait could be any value; in the current use case it Traits is the union of block.features[*].values.Trait
 * @param fieldName 'Traits' or 'Ontologies'
 * @return a value-tree
 * @desc
 * related : manage-explorer :  parentAndScope(), addParentAndScopeLevels().
 */
function blocksParentAndScope(levelMeta, fieldName, blocksTraits) {

  let
  /** convert : [ { block, Traits: [ ...]}, ...]
   * to : [Trait] [block, ... ]
   */
  byTrait = blocksValuesUnwindAndGroup(blocksTraits, fieldName),
  tree = Object.fromEntries(
    Object.entries(byTrait)
      .map(([key, value]) => [key, blocksParentAndScope2(levelMeta, value)]));
  levelMeta.set(tree, 'Groups');
  return tree;
}

/** For use as a d3.nest() key function, return the dataset parent name of the given block.
 */
function parentOfBlock(block) {
  /** use .dataset : .parent.name or .parentName */
  return block.get('datasetParentName');
}

function scopeOfBlock(block) {
  return block.get('scope');
}


/** Given an array blocks,
 * group the blocks by : Trait / block.datasetId.parentName / block.scope
 */
function blocksParentAndScope2(levelMeta, blocks) {

  let
  nested = d3.nest()
    /* the key function will return undefined or null for datasets without parents, which will result in a key of 'undefined' or 'null'. */
    .key(parentOfBlock)
    .key(scopeOfBlock)
    .entries(blocks);
  let parentObjects = fromNestedParentAndScope(levelMeta, nested);
  if (trace_values > 1) {
    dLog('blocksParentAndScope2', nested, parentObjects);
  }
  return parentObjects;
}

/** Convert a single-level d3.nested() to Object. */
function fromNested(nested) {
  let object = Object.fromEntries(nested.map((kv) => [kv.key, kv.values]));

}
/** Convert a multi-level d3.nested() to Object.
 * Label the values with childLabels : first level of child values are labelled
 * with childLabels[0], ....
 */
function fromNestedMulti(levelMeta, nested, childLabels) {
  let 
  childLabel = childLabels[0],
  /** for the next level down */
  childLabelsNext = childLabels.slice(1),
  objects = nested.reduce((po, kv) => {
    let values = kv.values;
    if (values.length && values[0].key && values[0].values) {
      values = fromNestedMulti(levelMeta, values, childLabelsNext);
    }
    po[kv.key] = values;
    levelMeta.set(values, childLabel);
    return po;
  }, {});

  return objects;
}

function fromNestedParentAndScope(levelMeta, nested) {
  let parentObjects = fromNestedMulti(levelMeta, nested, ['Parent', 'Scope']);
  return parentObjects;
}

/*----------------------------------------------------------------------------*/

/** Order the given array of blocks : first the reference blocks, then the data blocks.
 *
 * Originally used to sort viewed blocks, and apply ensureAxis(), so that axes
 * were constructed for references before data.
 */
function blocksReferencesBeforeData(blocks) {
  const
  referencesFirst = blocks.sort((a,b) => {
    let aHasReference = !!a.get('referenceBlock'),
        bHasReference = !!b.get('referenceBlock');
    return aHasReference === bHasReference ? 0 : aHasReference ?  1 : -1;
  });
  return referencesFirst;
}

//------------------------------------------------------------------------------


export { blocksValuesUnwindAndGroup, blocksParentAndScope }  
