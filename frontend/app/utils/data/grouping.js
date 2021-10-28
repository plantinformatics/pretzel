/*----------------------------------------------------------------------------*/

/* global d3 */

/*----------------------------------------------------------------------------*/

const trace_values = 0;
const dLog = console.debug;


/*----------------------------------------------------------------------------*/

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
  byTrait = 
    blocksTraits.reduce((result, blockTraits) => {
      blockTraits[fieldName].forEach((trait) => {
        (result[trait] ||= []).push(blockTraits.block);
      });
      return result;
    }, {}),
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
  let
  f = block.get('datasetId'),
  p = f.get && f.get('parent');
  return p ? p.get('name') : f.get('parentName');
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
  dLog('blocksParentAndScope2', nested, parentObjects);
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


export { blocksParentAndScope }  
