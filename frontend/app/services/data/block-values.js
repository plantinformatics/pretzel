import EmberObject, { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Service, { inject as service } from '@ember/service';

import {
  valueGetType, mapHash, reduceHash, reduceIdChildrenTree, justUnmatched,
  logV,
  collateOntologyId2Node,
  ontologyIdFromIdText,
  treeFor,
 } from '../../utils/value-tree';

import {
  blockValues,
  blockValuesBlocks,
  blockValuesViewed,
  blockValuesTree,
  blockFeatureOntologiesTreeEmbeddedFn,
  idParentNodeMap,
} from '../../utils/data/block-values';

import { blocksValuesUnwindAndGroup } from '../../utils/data/grouping';

const dLog = console.debug;

const trace = 1;


/** Collations of apiServer:blockFeatureOntologies
 * Used in both components/panel/{manage-explorer,ontologies}
 * (first developed in manage-explorer).
 */
export default Service.extend({
  block : service('data/block'),
  controls : service(),
  ontology : service('data/ontology'),

  apiServerSelectedOrPrimary : alias('controls.apiServerSelectedOrPrimary'),
  blocksService : alias('block'),
  treesForData : alias('ontology.treesForData'),

  // ---------------------------------------------------------------------------

  levelMeta : new WeakMap(),

  // ---------------------------------------------------------------------------

  blockFeatureOntologies : computed(
    'apiServerSelectedOrPrimary.blockFeatureOntologies',
    'apiServerSelectedOrPrimary.datasetsBlocks.[]',
    /** comment in feature-edit.js : saveFeature() */
    'blocksService.featureUpdateCount',
    function () { return blockValues.apply(this, ['Ontologies']); }),

  /** map ._id to .block */
  blockFeatureOntologiesBlocks : computed(
    'apiServerSelectedOrPrimary.blockFeatureOntologies',
    'apiServerSelectedOrPrimary.datasetsBlocks.[]',
    'blocksService.featureUpdateCount',
    function () { return blockValuesBlocks.apply(this, ['Ontologies']); }),

  // ---------------------------------------------------------------------------

  /** filter for viewed blocks. */
  blockFeatureOntologiesViewed : computed(
    'blockFeatureOntologiesBlocks',
    'block.viewed.[]',
    function () { return blockValuesViewed.apply(this, ['Ontologies']); }),

  // ---------------------------------------------------------------------------

  /** Ontology tree of QTLs of viewed blocks. */
  blockFeatureOntologiesTree : computed(
    'blockFeatureOntologiesViewed',
    function () { return blockValuesTree.apply(this, ['Ontologies', 'blockFeatureOntologiesViewed']); }),

  // ---------------------------------------------------------------------------

  /** Same as blockFeatureOntologiesTreeEmbedded, except this is filtered by viewed blocks */
  blockFeatureOntologiesViewedEmbedded : computed('blockFeatureOntologiesViewed', 'ontologyId2DatasetNodes', function () {
    let
    fnName = 'blockFeatureOntologiesViewedEmbedded',
    id2nP = this.get('ontologyId2Node'),
    treeP = this.get('treesForData'),
    viewedP = this.get('blockFeatureOntologiesViewed'),
    id2PnP = this.get('ontologyId2DatasetNodes'),
    promise = Promise.all([treeP, viewedP, id2nP, id2PnP]).then(([tree, viewed, id2n, id2Pn]) => {
      let
      /** viewed is in blocksTraits form */
      grouped = blocksValuesUnwindAndGroup(viewed, 'Ontologies'),
      valueTree = treeFor(this.get('levelMeta'), tree, id2n, grouped);
      this.levelMeta.set(valueTree, {typeName : 'term', name : 'CO'});
      return blockFeatureOntologiesTreeEmbeddedFn(this.levelMeta, valueTree, id2Pn);
    })
      .catch(error => { dLog(fnName, error.responseJSON.error || error); return Promise.resolve({}); });
    return promise;
  }),



  /** Same as in manage-explorer, except local ontologyId2DatasetNodes is not filtered by search filter and historyView.  */
  blockFeatureOntologiesTreeEmbedded : computed('treesForData', 'ontologyId2DatasetNodes', function () {
    let
    fnName = 'blockFeatureOntologiesTreeEmbedded',
    treeP = this.get('treesForData'), // single-root : ontologyTree
    id2PnP = this.get('ontologyId2DatasetNodes'),
    promise = Promise.all([treeP, id2PnP])
      .then(([tree, id2Pn]) => blockFeatureOntologiesTreeEmbeddedFn(this.levelMeta, tree, id2Pn))
      .catch(error => { dLog(fnName, error.responseJSON.error || error); return Promise.resolve({}); });
    return promise;
  }),

  /** OntologyId of QTLs of viewed blocks. */
  ontologyId2DatasetNodes : computed('blockFeatureOntologiesTree.isFulfilled', function () {
    let
    blocksOntologiesTree = this.get('blockFeatureOntologiesTree'),
    fieldName = 'Ontologies',
    promise = blocksOntologiesTree
      .then((bot) => idParentNodeMap(bot));

    return promise;
  }),

  // ---------------------------------------------------------------------------

  /** collate a mapping [OntologyId] -> tree node */
  ontologyId2Node : computed('blockFeatureOntologiesTreeEmbedded', function () {
    /** use blockFeatureOntologiesTreeEmbedded in place of ontologyTree, to have .parent. */
    let treeP = this.get('blockFeatureOntologiesTreeEmbedded');
    let id2node = treeP.then((tree) => collateOntologyId2Node(tree));
    return id2node;
  }),
  /** similar to ontologyId2Node, based on blockFeatureOntologiesViewedEmbedded
   * which is filtered according to Viewed.  */
  ontologyId2NodeFor : computed('blockFeatureOntologiesViewedEmbedded', function () {
    let treeP = this.get('blockFeatureOntologiesViewedEmbedded');
    let id2node = treeP.then((tree) => collateOntologyId2Node(tree));
    return id2node;
  }),

  //----------------------------------------------------------------------------

});
