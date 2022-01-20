import { resolve, all } from 'rsvp';

import ObjectProxy from '@ember/object/proxy';
import PromiseProxyMixin from '@ember/object/promise-proxy-mixin';

import { singularize, pluralize } from 'ember-inflector';


import { toPromiseProxy } from '../../utils/ember-devel';

import { blocksParentAndScope } from './grouping';
import {
  reduceHash,
  ontologyIdFromIdText,
  mapTree,
 } from '../../utils/value-tree';


// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

/** Functions to collate blockFeature{Traits,Ontologies}
 * Used in services/data/block-values and
 * components/panel/{manage-explorer,ontologies}
 * (first developed in manage-explorer, for Traits).
 */

// -----------------------------------------------------------------------------

/**
 * CP : blockFeatureTraits
 * Used in blockFeature{Traits,Ontologies}, which are used only for checking
 * .length in panel/{manage-explorer,ontologies}.hbs
 * @param fieldName 'Traits' or 'Ontologies'
 */
function blockValues(fieldName) {
  let ObjectPromiseProxy = ObjectProxy.extend(PromiseProxyMixin);

  let count = this.get('blocksService.featureUpdateCount');
  dLog('blockValues', fieldName, count, this);
  let valueP = this.get('apiServerSelectedOrPrimary.blockFeature' + fieldName);
  let proxy = ObjectPromiseProxy.create({ promise: resolve(valueP) });
  return proxy;
}

/** map ._id to .block
 * CP : blockFeatureTraitsBlocks
 * Used by : blockValuesHistory()
 * @param fieldName 'Traits' or 'Ontologies'
 */
function blockValuesBlocks(fieldName) {
  // 'blockFeatureTraits'
  let apiServer = this.get('apiServerSelectedOrPrimary');
  let blocksTraitsP = apiServer.get('blockFeature' + fieldName);
  let store = apiServer.get('store');
  /** ids2Blocks() depends on this result. */
  if (! apiServer.get('datasetsBlocks')) {
    blocksTraitsP = Promise.resolve([]);
  } else {
    blocksTraitsP = blocksTraitsP
      .then((blocksTraits) => {
        blocksTraits = ids2Blocks(store, blocksTraits);
        blocksTraits = checkPositions(blocksTraits, fieldName);
        storeBlockAttributes(blocksTraits, fieldName);
        return blocksTraits;
      });
  }
  return blocksTraitsP;
}

/** filter for viewed blocks. */
function blockValuesViewed(fieldName) {
  let
  blocksTraitsP = this.get('blockFeature' + fieldName + 'Blocks')
    .then((blocksTraits) => {
      let viewed = blocksTraits.filter((bt) => bt.block.isViewed);
      return viewed;
    });
  return blocksTraitsP;
}


/** Store the Traits / Ontologies of each block, to enable loadBlock() to make
 * them visible.
 * @param blocksValues is the result of checkPositions(), i.e. QTLs which will
 * not be displayed because of lack of position / .values.<fieldName> are filtered out.
 */
function storeBlockAttributes(blocksValues, fieldName) {
  blocksValues.forEach((bt) => {
    let
    block = bt.block,
    values = bt[fieldName],
    attr = block.get('attributes') || block.set('attributes', {});
    attr[fieldName] = values;
  });
}

/** map blocksTraits : if .block has .positioned.<fieldName>
 * use that in place of .<fieldName>
 * @param fieldName is plural; the singular form is used for .positioned.<fieldName>
 */
function checkPositions(blocksTraits, fieldName) {
  let fieldNameSingular = singularize(fieldName);
  let bts = blocksTraits.map((bt) => {
    let names = bt.block.get('positioned.' + fieldNameSingular);
    if (names && (names.length !== bt[fieldName].length)) {
      dLog('checkPositions', bt[fieldName], names);
      bt = Object.assign({}, bt);
      bt[fieldName] = names;
    }
    return bt;
  });
  return bts;
}

/**
 * CP : blockFeatureTraitsHistory
 * @param historyView values are : undefined, 'Normal', 'Recent', 'Viewed'
 */
function blockValuesHistory (fieldName, historyView) {
  let blocksTraitsP = this.get('blockFeature' + fieldName + 'Blocks');
  if (historyView !== 'Normal') {
    blocksTraitsP = blocksTraitsP
      .then((blocksTraits) => {
        const
        recent = historyView === 'Recent',
        /** map blocks -> Traits, so that the sorted blocks can be mapped -> blocksTraits  */
        blocksTraitsMap = blocksTraits.reduce((btm, bt) => btm.set(bt.block, bt[fieldName]), new Map()),
        blocks = blocksTraits.map((bt) => bt.block),
        /** sorted blocks */
        blocksS = (historyView === 'Viewed') ?
          blocksFilterCurrentlyViewed(blocks) :
          this.get('viewHistory').blocksFilterSortViewed(blocks, recent),
        blocksTraitsS = blocksS.map((b) => addField({block : b}, fieldName, blocksTraitsMap.get(b)));
        return blocksTraitsS;
      });
  }
  return blocksTraitsP;
}


function addField(object, fieldName, value) {
  object[fieldName] = value;
  return object;
}

/** Filter the given array of blocks to just those which are currently viewed.
*/
function blocksFilterCurrentlyViewed(blocks) {
  let
  blocksSorted = blocks
    .filter((b) => b.isViewed);
  return blocksSorted;
};


/**
 * Used as a pre-process for (fieldName === 'Ontologies')
 * in blockValuesNameFiltered (CP : blockFeatureOntologiesName)
 * @param me  manage-explorer
 */
function blockValuesIdText(me, blocksTraits) {
  blocksTraits.forEach((bt) => {
    bt.Ontologies = bt.Ontologies
      .filter((oid) => oid !== '')
      .map((oid)=> {
        let result = oid;
        if (! oid.startsWith('[')) {
          let name = me.get('ontology').getNameViaPretzelServer(oid);
          if (typeof name === 'string') {
            result = '[' + oid + '] ' + name;
          }
        }
        return result;
      });
  });
  return blocksTraits;
}


/**
 * CP : blockFeatureTraitsName
 */
function blockValuesNameFiltered (fieldName) {
  let
  nameFilters = this.get('nameFilterArray'),
  blocksTraitsP = this.get('blockFeature' + fieldName + 'History');

  if (fieldName === 'Ontologies') {
    blocksTraitsP = blocksTraitsP
      .then((bts) => blockValuesIdText(this, bts) );
  }

  if (nameFilters.length) {
    blocksTraitsP = blocksTraitsP
      .then((blocksTraits) => {
        blocksTraits = blocksTraits
          .map((blockTraits) => this.blockTraitsFilter(fieldName, blockTraits, nameFilters))
          .filter((blockTraits) => blockTraits[fieldName].length);
        return blocksTraits;
      });
  }
  return blocksTraitsP;
}

/*
 * CP : blockFeatureTraitsTree
 */
function blockValuesTree (fieldName, valueName) {
  let ObjectPromiseProxy = ObjectProxy.extend(PromiseProxyMixin);

  let
  valueP = this.get(valueName)
    .then((blocksTraits) => {
      let
      blocksTraitsTree = blocksParentAndScope(this.get('levelMeta'), fieldName, blocksTraits);
      this.set('blockFeature' + fieldName + 'TreeKeyLength', Object.keys(blocksTraitsTree).length);
      return blocksTraitsTree;
    });
  let proxy = ObjectPromiseProxy.create({ promise: resolve(valueP) });

  return proxy;
}

/** map blockIdsTraits[]
 * from {_id, Traits} to {block, Traits}
 * or from {_id, Ontologies} to {block, Ontologies}
 */
function ids2Blocks(store, blockIdsTraits) {
  let
  blocksTraits = store && blockIdsTraits
    .map(({_id, ...rest}) => (rest.block = store.peekRecord('block', _id), rest))
    .filter((bt) => bt.block);
  return blocksTraits;
}

/**
 */
function blockFeatureOntologiesTreeEmbeddedFn(levelMeta, tree, id2Pn) {
  /* used in blockFeatureOntologiesTreeEmbedded in components/panel/manage-explorer and 
 */
  let
  fnName = 'blockFeatureOntologiesTreeEmbeddedFn';

  dLog(fnName, 'id2Pn', id2Pn);
  let
  valueTree = mapTree(levelMeta, id2Pn, tree);
  levelMeta.set(valueTree, 'term');

  Object.values(valueTree).forEach((t) => t.parent = valueTree);
  /*
  let childNames = Object.keys(valueTree);
  valueTree.name = childNames.length ? childNames[0].slice(0,2) : 'CropOntology';
  */

  dLog('blockFeatureOntologiesTreeEmbedded', valueTree);
  return valueTree;
}

/** @return an Object mapping from the text values of the nodes of the tree (bot)
 * The text is constructed from .id and .text using ontologyIdFromIdText().
 * Used in ontologyId2DatasetNodes, in manage-explorer and services/data/block-values.js
 * @param bot blockFeatureOntologiesTree
 */
function idParentNodeMap(bot) {
  /** traverse the parent level, add the Ontology ID Node {id, blocks} */
  let id2n = reduceHash(
    bot,
    (result, key, value) => {
      key = ontologyIdFromIdText(key);
      (result[key] ||= []).push(value);
      return result;
    },
    {});
  return id2n;
};


// -----------------------------------------------------------------------------

export {
  blockValues,
  blockValuesBlocks,
  blockValuesViewed,
  storeBlockAttributes,
  checkPositions,
  blockValuesHistory,
  addField,
  blocksFilterCurrentlyViewed,
  blockValuesIdText,
  blockValuesNameFiltered,
  blockValuesTree,
  ids2Blocks,
  blockFeatureOntologiesTreeEmbeddedFn,
  idParentNodeMap,
}

// -----------------------------------------------------------------------------
