
/* global Ember */

import { isArray } from '@ember/array';

const trace_values = 0;
const dLog = console.debug;


/*----------------------------------------------------------------------------*/

/** levelMeta.get(value) is simply the data type name, except in the case of
 * the multi-root of the ontology tree, which also has a name attribute,
 * i.e. {typeName : 'term', name : 'CO'}
 * This addition might lead to other values in the meta, perhaps a class with
 * access functions.
 * This function accesses the data type name, irrespective of whether the meta is
 * just the type name (string) or an object containing .typeName
 */
function valueGetType(levelMeta, value) {
  let valueType = levelMeta.get(value);
  if (valueType?.typeName) {
    valueType = valueType.typeName;
  }
  return valueType;
}


/*----------------------------------------------------------------------------*/
/* Functional programming utilities.
 * Lodash is already included by various packages, so may use that, or possibly Ramda.
 */

/** Analogous to Array map(), produce a result parallel to the input, having the
 * same keys, and a value for each key based on the corresponding value of the
 * input hash.
 * @param h  input hash (object)
 * @param fn function(key, value) -> value which transforms the values.
 */
function mapHash(h, fn) {
  let result = {};
  for (var key in h) {
    if (h.hasOwnProperty(key)) {
      let value = h[key];
      console.log('mapHash', key, value);
      result[key] = fn(key, value);
    }
  }
  console.log('mapHash', h, '->', result);
  return result;
}

/*----------------------------------------------------------------------------*/


/** Analogous to Array forEach(), call function for each key:value pair of the
 * input hash.
 * Similar to mapHash().
 * @param h  input hash (object)
 * @param fn function(key, value)
 */
function forEachHash(h, fn) {
  // based on mapHash().
  console.log('forEachHash', h);
  for (var key in h) {
    if (h.hasOwnProperty(key)) {
      let value = h[key];
      console.log('forEachHash', key, value);
      fn(key, value);
    }
  }
}


/** Analogous to Array .reduce(), call function for each key:value pair of the
 * input hash, passing & returning result.
 * Similar to mapHash().
 * @param h  input hash (object)
 * @param fn function(result, key, value) -> result
 * @param result
 */
function reduceHash(h, fn, result) {
  const fnName = 'reduceHash';
  // based on mapHash().
  dLog(fnName, h, result);
  for (var key in h) {
    if (h.hasOwnProperty(key)) {
      let value = h[key];
      if (trace_values > 2) {
        dLog(fnName, key, value, result);
      }
      result = fn(result, key, value);
    }
  }
  return result;
}


/** Similar to reduceHash(); this is specific to the tree returned by
 * services/data/ontology.js : getTree(), and copied by manage-explorer.js :
 * mapTree() and treeFor().
 * Similar to walkTree() (manage-explorer.js);  difference : this passes parentKey, index to fn;
 * The API of the tree used by this function is {id, children : []}.
 * Analogous to Array .reduce(), call function for each key:value pair of the
 * input hash, passing & returning result.
 * @param tree  input tree (object : {id, children : [], .. }
 * @param fn function(result, parentKey, index, value) -> result
 * @param result
 */
function reduceIdChildrenTree(tree, fn, result) {
  const fnName = 'reduceIdChildrenTree';
  dLog(fnName, tree, result);
  return reduceIdChildrenTreeR(tree, /*parentKey*/undefined, /*index*/-1, fn, result);
}
/** The recursive part of reduceIdChildrenTree().
 */
function reduceIdChildrenTreeR(tree, parentKey, index, fn, result) {
  // based on mapTree0().

  result = fn(result, parentKey, index, tree);

  let children = tree.children;
  if (children === undefined) {
    result = Object.entries(tree).reduce(
      (result2, e) => reduceIdChildrenTreeR(e[1], tree.id, e[0], fn, result2), result);
  } else if (isArray(children)) {
    result = children.reduce((result1, childNode, i) => {
        result1 = reduceIdChildrenTreeR(childNode, tree.id, i, fn, result1);
        return result1;
      }, result);
  }

  return result;
}


/*============================================================================*/

/* global d3 */

/**
 * @return true if value is just {unmatched : ... }, i.e. it is an object with
 * only 1 key, and that key is 'unmatched'.
 */
function justUnmatched(value) {
  // could instead pass a flag to datasetFilter() to discard unmatched.
  let result = value.hasOwnProperty('unmatched') && (Object.keys(value).length === 1);
  return result;
}

/*============================================================================*/
/* For logging value tree constructed in data explorer - manage-explorer.js */

/** For devel logging - log the contents of the given value tree v.
 * @param levelMeta annotations of the value tree, e.g. dataTypeName text.
 */
function logV(levelMeta, v) {
  console.log(v);
  if (v && v.constructor === Map) {
    v.forEach(function (key, value) {
      console.log(key, levelMeta.get(value));
      logV(levelMeta, value);
    });
  }
  /** may have Ember.isArray(v) and (typeof v === 'object') (e.g. result of
   * computed property / promise array proxy), so test for array first.
   */
  else if (isArray(v)) {
    v.forEach(function (value) {
      console.log(levelMeta.get(value));
      logV(levelMeta, value);
    });
  }
  else if (v.constructor.modelName) {
    /* Ember object */
    console.log(
      v.constructor.modelName,
      v.get('name'),
      v._internalModel.__data
    );
  }
  else if (typeof v === 'object') {
    forEachHash(v, function (key, value) {
      console.log(key, levelMeta.get(value));
      logV(levelMeta, value);
    });
  }
  else
    console.log(levelMeta.get(v), v);
}

/*----------------------------------------------------------------------------*/

/** Count the leaf values, i.e. the blocks.
 * This is used when deciding whether to auto-expand all levels down to the leaves.
 * It is desirable to expand all (using allActive) if the displayed list is then
 * only a couple of pages, i.e. if there are a reasonable number of leaves.
 * @see autoAllActive(), allActive
 *
 * @param levelMeta annotations of the value tree, e.g. dataTypeName text.
 * @param values  a value tree
 */
function leafCount(levelMeta, values) {
  /** Traverse the value tree, similar to logV() above; it is probably not
   * necessary to handle all node types as logV() does, since leafCount() is
   * simply counting the leaves not visiting them.
   */
  let 
    datasetIds = Object.keys(values),
  count0 =
    datasetIds.reduce((count1, d) => {
      let
        value = values[d],
      /** If value is an array of Blocks, simply add .length to count, otherwise
       * it is a hash of scopes - traverse them and sum the .length of the
       * blocks array of each.
       * Ember.isArray(scopes) could instead be used to discern these 2 cases.
       */
      valueType = valueGetType(levelMeta, value);
      if (valueType == "Blocks") {
        count1 += value.length;
      }
      else if (
        // getting "Dataset";  not sure if values should include that.
        (valueType == "Dataset") && 
          value.get &&
          value.get('isLoaded')) {
        dLog('leafCount', valueType, value.get('id'), value.get('name'), value.get('blocks'));
        count1 += value.get('blocks.length');
      }
      else {
        let
          scopes = value,
          scopeNames =  Object.keys(scopes);
        count1 = scopeNames.reduce((sum, s) => {
          if (trace_values > 1)
          dLog(sum, s, scopes[s]);
          return sum+=scopes[s].length;
        }, count1);
      }
      if (trace_values > 1)
      console.log(value, valueType, count1);
      return count1;
    }, 0);
  if (trace_values)
  console.log('leafCount', values, datasetIds, count0);

  return count0;
}

/*----------------------------------------------------------------------------*/

/** Count blocks in Ontology tree.
 */
function leafCountIdChildrenTree(levelMeta, tree) {
  function addCount(result1, parentKey, index, value) {
    /** value.node[] is an array of parents (blocks grouped by parent / scope),
     * added by manage-explorer : mapTree()
     */
    if (value.node) {
      result1 = value.node.reduce((result2, parentGroup) => result2 += leafCount(levelMeta, parentGroup), result1);
    }
    return result1;
  };
  let result = reduceIdChildrenTree(tree, addCount, 0);
  return result;
}


function leafCountOntologyTab(levelMeta, values) {
  let count;
  let dataTypeName = valueGetType(levelMeta, values);

  switch (dataTypeName) {
  case 'Groups' :
    count = reduceHash(
      values,
      (result, key, value) => result += leafCount(levelMeta, value),
      0);
    break;
  case 'term' : count = leafCountIdChildrenTree(levelMeta, values);
    break;
  default :
    dLog('autoAllActive', dataTypeName, values);
    break;
  }
  return count;
}

// -----------------------------------------------------------------------------

/** The tree created by blockFeatureOntologiesTreeEmbedded() has .node, added by mapTree().
 * These are not required in the view panel component panel/ontologies, and are
 * deleted by this function (this is a copy made by treeFor).
 */
function unlinkDataIdChildrenTree(tree) {
  /** based on leafCountIdChildrenTree(), which comments about value.node[]. */
  function deleteNodeAttr(result1, parentKey, index, value) {
    if (value.node) {
      delete value.node;
    }
  };
  reduceIdChildrenTree(tree, deleteNodeAttr, 0);
}

/** Replace levelMeta matchString with a copy of value, with .typeName : matchString.
 * @param tree   created by blockFeatureOntologiesTreeEmbedded(), has strings 'term' and 'trait' for ontology nodes.
 * @param matchString  e.g. 'term'
 * @param objectValue Object, copied with Object.assign({typeName : matchString}, value)
 */
function augmentMetaIdChildrenTree(tree, levelMeta, matchString, objectValue) {
  function augmentMatchingNode(result1, parentKey, index, value) {
    if (levelMeta.get(value) == matchString) {
      let newValue = Object.assign({typeName : matchString}, objectValue);
      levelMeta.set(value, newValue);
    }
  };
  reduceIdChildrenTree(tree, augmentMatchingNode, 0);
}


/*----------------------------------------------------------------------------*/

function typeMetaIdChildrenTree(levelMeta, tree) {
  function storeType(result, parentKey, index, value) {
    levelMeta.set(value, value.type);
  };
  reduceIdChildrenTree(tree, storeType, undefined);
  return levelMeta;
}

// -----------------------------------------------------------------------------

/** Given an id/children ontology tree, collate and return an object which maps
 * from node.id to node for all nodes of the tree.
 * Written for Ontology trees and used in ontologyId2Node(),
 * ontologyId2NodeFor(), this is generally applicable.
 */
function collateOntologyId2Node(tree) {
  /** Add a node to a result. */
  function reduceNode(result, parentKey, index, node) {
    let id = node.id;
    if (id) {
      result[id] = node;
    }
    return result;
  }
  let
  id2node = reduceIdChildrenTree(tree, reduceNode, {});
  return id2node;
}


/*----------------------------------------------------------------------------*/

/** if the OntologyId has been augmented with its text description, then parse
 * out the ID.
 * @param oid either e.g. "CO_338:0000017" or "[CO_338:0000017] Flower color"
 * @return just the ID, e.g. "CO_338:0000017" etc  (regexp handles :ROOT, or :Term Name)
 */
function ontologyIdFromIdText(oid) {
  if (oid.startsWith('[')) {
    let
    ontologyIdMatch = oid.match(/^\[(CO_[0-9]+.*)\]/);
    oid = ontologyIdMatch && ontologyIdMatch[1];
  }
  return oid;
}


/*============================================================================*/
/* Moved here from components/panel/manage-explorer.js after 7f881acb
 * These relate to trees with nodes having .id and .children
 */

/** reduce a tree to a result.
 * Used for Ontology tree, result of ontology service getTree();
 * each tree node has .id and .children.
 * Added : incorporate multiple roots into a single tree, so the top level in
 * that case will be an object { <rootId> : tree, ... }.
 * Similar signature to Array.reduce().
 * @param result
 * @param reduceNode Add a node to a result function reduceNode(result, node) -> result;
 * @param tree
 */
function walkTree(result, reduceNode, tree) {
  const fnName = 'walkTree';
  result = reduceNode(result, tree);
  let children = tree.children;
  if (isArray(children)) {
    result = children.reduce((result, node) => {
      result = walkTree(result, reduceNode, node);
      return result;
    }, result);
  }
  // dLog(fnName, result, tree);
  return result;
};

/** Similar to mapTree(), this produces a tree of nodes which are each just {id : value},
 * whereas mapTree() allows {id, type, node} to be included in the node.
 */
function mapTree0(levelMeta, result, tree) {
  let value = result[tree.id] = {};
  levelMeta.set(value, tree.type);
  tree.children.forEach((c) => mapTree0(levelMeta, value, c));
  return result;
};
/** Map the Ontology tree to a value-tree, with nodes containing :
 *   {id, type, children, node : dataset_ontology}
 * where dataset_ontology links to the corresponding node in the tree of
 * datasets by Ontology.
 * @param id2Node map OntologyId to {<parent> : {<scope> : [block, ...], ...}, ...}
 * @param tree  Ontology API result
 */
function mapTree(levelMeta, id2Node, tree) {
  let
  /** used by copyNode() to lookup a value for .parent */
  id2nc = {},
  value = copyNode(levelMeta, id2nc, tree),
  /** Originally tree was a single Ontology tree, now it can be multiple trees
   * in an object, e.g. Object { CO_321: {…}, CO_323: {…}, CO_366: {…}, CO_338: {…} }
   * in which case tree.id is not defined.
   * (that was not reported as an error when mapTree() was defined in manage-explorer).
   */
  node = tree.id && id2Node[tree.id];
  if (node) {
    value.node = node;
    if (trace_values > 1) {
      dLog('mapTree', value, node);
    }
  }
  if (value.text || value.id) {
    /** same format as ontologyNameId(), rootOntologyNameId()     */
    value.name = '[' + value.id + ']  ' + value.text;
  }

  if (tree.children === undefined) {
    /* copyNode copies attributes for node with .id & .children, but not for plain object. */
    /* optional : id2nc[value.name] = value;
     * copyNode() does id2nc[n.id] = c, i.e. id2nc[value.id] = value, but value.id is undefined
     */
    Object.entries(tree)
      .reduce((result, e) => {
        result[e[0]] = mapTree(levelMeta, id2Node, e[1]);
        return result;
      }, value);
  } else {
    let children = tree.children;
    if (isArray(children)) {
      value.children = children.map((c) => {
        /** copy of c */
        let cc = mapTree(levelMeta, id2Node, c);
        cc.parent = value;
        return cc; });
    } else if (children.children && children.id && children.text && children.type)
    {
      dLog('mapTree', 'value', value, 'tree', tree);      
      tree.children = [tree.children];
    }
  }

  return value;
};

/*----------------------------------------------------------------------------*/

/** Make a copy of tree, which is addressed by id2n, with only the branches required
 * to support id2Pn.
 * @param levelMeta to record the node types of the output tree
 * @param tree  ontologyTree
 * @param id2n  ontologyId2Node : references from OntologyId into the corresponding nodes in ontologyTree
 * @param id2Pn ontologyId2DatasetNodes : references from OntologyId into the parent nodes of blockFeatureOntologiesTree
 */
function treeFor(levelMeta, tree, id2n, id2Pn) {
  let
  id2nc = {},
  treeCopy = copyNode(levelMeta, id2nc, tree);
  /* could use forEachHash(), or pass {id2n, id2nc} as result in & out;
   * or filterHash() | mapHash() (will that add the root ok ?).
   */
  /*treeCopy =*/ reduceHash(id2Pn, (t, oid, p) => {
    oid = ontologyIdFromIdText(oid);
    let on = id2n[oid];
    if (! on) {
      dLog('treeCopy', oid, 'not present in', id2n);
    } else {
      addNode(levelMeta, id2nc, on);
    }
  }, treeCopy);
  return treeCopy;
};
/** Copy just 1 node. */
function copyNode(levelMeta, id2nc, n) {
  /** copy of node n */
  let c;
  if (n.children === undefined) {
    dLog('copyNode', 'roots', n);
    c = {};
  } else {
    c = Object.assign({}, n);
    if (typeof n.children !== 'boolean') {
      c.children = [];
    }
  }
  levelMeta.set(c, n.type);
  id2nc[n.id] = c;
  if (n.parent) {
    c.parent = id2nc[n.parent.id];
  }
  return c;
}
/** Add a copy of on to t, and supporting branch.
 * @param id2nc index into treeCopy.
 * @param on  node from ontologyTree
 */
function addNode(levelMeta, id2nc, on) {
  let onc = id2nc[on.id];
  if (! onc) {
    let parent = on.parent;
    if (parent) {
      // change parent to refer to the copy of parent.
      parent = addNode(levelMeta, id2nc, parent);
    }
    onc = copyNode(levelMeta, id2nc, on);
    if (parent) {
      if (parent.children) {
        parent.children.push(onc);
      } else {
        parent[onc.id] = onc;
      }
    }
  }
  return onc;
}

/*----------------------------------------------------------------------------*/

/** @return a count of the children at the top level, or 2nd level if valueTree is multiple roots.
 * @desc possibly displaying the leaf count would be more useful.
 */
function treesChildrenCount(valueTree) {
  let count = valueTree.children ?
      valueTree.children.length :
      Object.values(valueTree).reduce((result, vt) => result += vt.children.length, 0);
  return count;
}

/*============================================================================*/

export {
  valueGetType,
  mapHash, forEachHash, reduceHash, reduceIdChildrenTree,
  justUnmatched, logV,
  leafCount, leafCountOntologyTab,
  unlinkDataIdChildrenTree,
  augmentMetaIdChildrenTree,
  typeMetaIdChildrenTree,
  collateOntologyId2Node,
  ontologyIdFromIdText,

  walkTree,
  mapTree,
  treeFor,
  /** these don't need to be exported - used only by treeFor().
  copyNode,
  addNode,
  */
  treesChildrenCount,

};
