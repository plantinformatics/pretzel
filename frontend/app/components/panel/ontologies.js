import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';
import { computed } from '@ember/object';
import { A } from '@ember/array';
import { bind } from '@ember/runloop';

import { toPromiseProxy } from '../../utils/ember-devel';
import { unlinkDataIdChildrenTree, augmentMetaIdChildrenTree, ontologyIdFromIdText, treeFor } from '../../utils/value-tree';

// -----------------------------------------------------------------------------

const dLog = console.debug;



// -----------------------------------------------------------------------------

export default Component.extend({
  ontology : service('data/ontology'),
  block : service('data/block'),
  blockValues : service('data/block-values'),

  ontologyId2Node : alias('blockValues.ontologyId2Node'),
  blockFeatureOntologiesTreeEmbedded : alias('blockValues.blockFeatureOntologiesTreeEmbedded'),

// alias('ontology.ontologyCollation'),
  ontologyCollation : computed('controlOptions.enableView', function () {
    let
    oc = this.controlOptions.enableView && this.get('ontology.ontologyCollation');
    dLog('ontologyCollation', oc, this.controlOptions.enableView, this);
    return oc;
  }),
  get blockFeatureOntologies() { return this.get('blockValues.blockFeatureOntologies'); },
  ontologiesTree : computed(
    // 'ontologyCollation.ontologiesTree',  // has embedded datasets : parent / scope / block
    'controlOptions.enableView',
    'controlOptions.showHierarchy',
    'blockFeatureOntologiesTreeOnly',
    'blockFeatureOntologiesNameFlatMeta',
    function () {
      let
      ot = this.controlOptions.enableView && 
        (this.get('controlOptions.showHierarchy') ? 
         this.get('blockFeatureOntologiesTreeOnly') : 
         this.get('blockFeatureOntologiesNameFlatMeta'));
      dLog('ontologiesTree', ot, this.ontologyCollation, this);
      return ot;
    }),
  /** Filter out blocks which have no Ontology, wrap in PromiseProxy.
   */ 
  blockFeatureOntologiesName : computed('blockValues.blockFeatureOntologiesBlocks', function () {
    const
    fieldName = 'Ontologies',
    boP = this.get('blockValues.blockFeatureOntologiesBlocks'),
    bofP = boP?.then(
      (bos) => bos.filter((blockTraits) => blockTraits[fieldName].length));
    return bofP && toPromiseProxy(bofP);
  }),
  /** Extract the unique Ontologies as an single array.
   * Filter for blocks which are currently viewed.
   * The term 'Ontology' might be reserved for the group of OntologyIDs, i.e. the ROOT;
   * the values here are OntologyIDs.
   */
  blockFeatureOntologiesNameFlat : computed(
    'blockValues.blockFeatureOntologiesBlocks',
    'block.viewed.[]',
    function () {
    const
    fieldName = 'Ontologies',
    boP = this.get('blockValues.blockFeatureOntologiesBlocks'),
    bouP = boP?.then(
      (bos) => {
        let
        a = bos.reduce(
          (result, blockTraits) => {
            if (blockTraits.block.isViewed) {
              blockTraits[fieldName].forEach((o) => result.addObject(o));
            }
            return result;
          }, A());
        return a;
      });
    return bouP;
  }),
  /** Set levelMeta to 'trait' for the Ontologies, to enable value-tree to present them.
   */
  blockFeatureOntologiesNameFlatMeta : computed('blockFeatureOntologiesNameFlat', function () {
    let
    oP = this.get('blockFeatureOntologiesNameFlat'),
    omP = oP?.then(
      (os) => os.map((o) => this.ontologyIdToValue(o)));
    return omP && toPromiseProxy(omP);
  }),
  /** The leaf values of the view panel Ontology tree are OntologyIDs.
   * To be node values in a value-tree they need to be Object not string, and have a levelMeta value.
   * This function converts and OntologyID to an Object for use in a value-tree.
   * @param ontologyId  may be "[ontologyId] description"
   */
  ontologyIdToValue(ontologyId) {
    let
    o = {name : ontologyId},
    checkbox = this.checkbox(ontologyIdFromIdText(ontologyId)),
    meta = {typeName : 'trait', checkbox};
    this.levelMeta.set(o, meta);
    return o;
  },
  checkbox(ontologyId) {
    let me = this;
    let ontologyIdFromValue = this.ontologyIdFromValue;
    /** blockFeatureOntologiesTreeOnly() passes a constant checkbox to
     * augmentMetaIdChildrenTree() - ontologyId is undefined. */
    return {
      checked : (values) => this.get('ontology').getOntologyIsVisible(ontologyId || ontologyIdFromValue(values)),
      changed : function (checked) { me.toggleVisibility(checked, ontologyIdFromValue(this.values)); }
    };
  },
  ontologyIdFromValue(values) {
    let
    /** if ! showHierarchy, values is e.g. {name : "[CO_321:0000020] Plant height"} */
    ontologyId = values.id ||
      (values.name && ontologyIdFromIdText(values.name));
    return ontologyId;
  },
  blockFeatureOntologiesViewedIds : computed('blockFeatureOntologiesNameFlat', function () {
    let
    oP = this.get('blockFeatureOntologiesNameFlat'),
    oiP = oP?.then(
      (os) => os.map((o) => ontologyIdFromIdText(o)));
    return oiP;
  }),
  blockFeatureOntologiesTreeOnly : computed(
    'blockFeatureOntologiesTreeEmbedded',
    'ontologyId2Node',
    // 'ontologyId2DatasetNodes',
    'blockFeatureOntologiesViewedIds',
    function () {
      /** similar to blockFeatureOntologiesTreeGrouped(); only a couple of lines in common in the non-promise part.
       * That function also does treesChildrenCount().
       */
      let
      fnName = 'blockFeatureOntologiesTreeOnly',
      oc = this.ontologyCollation,
      /** use blockFeatureOntologiesTreeEmbedded instead of ontologyTree because
       * the former has added .parent links
       * It also has .node, added by mapTree(); these are deleted from the copy.
       */
      treeP = this.get('blockFeatureOntologiesTreeEmbedded'),
      id2nP = this.get('ontologyId2Node'),
      id2PnP = this.get('blockFeatureOntologiesViewedIds'),  // was ontologyId2DatasetNodes
      promise = Promise.all([treeP, id2nP, id2PnP]).then(([tree, id2n, id2Pn]) => {
        dLog(fnName, tree, id2n, 'id2Pn', id2Pn);
        /** convert array to Object, which treeFor() expects. */
        id2Pn = id2Pn.reduce((result, oid) => {result[oid] = true; return result;}, {});
        let
        valueTree = treeFor(this.get('levelMeta'), tree, id2n, id2Pn);
        /** treeFor() makes a copy so it is not necessary for unlinkDataIdChildrenTree() to make a copy. */
        unlinkDataIdChildrenTree(valueTree);
        let checkbox = this.checkbox(/*ontologyId*/ undefined);
        augmentMetaIdChildrenTree(valueTree, this.levelMeta, 'term', {checkbox});
        augmentMetaIdChildrenTree(valueTree, this.levelMeta, 'trait', {checkbox});
        this.levelMeta.set(valueTree, {typeName : 'term', name : 'CO'});

        dLog(fnName, valueTree);
        return valueTree;
      });

      let proxy = toPromiseProxy(promise);
      return proxy;
  }),

  levelMeta : alias('blockValues.levelMeta'),


  // ---------------------------------------------------------------------------

  controlOptions : {
    enableView : false,
    showHierarchy : true,
  },
  showHierarchyChanged(value) {
    dLog('showHierarchyChanged', value);
  },

  // ---------------------------------------------------------------------------

  didInsertElement() {
    this._super(...arguments);
    dLog('didInsertElement');
    /** If this component evaluates some CPs (e.g. ontologiesTree) in
     * ontologyCollation (manage-explorer) before that component does, they do
     * not gain a value, remaining simply .isFulfilled:false, .content:null.
     * So this component delays use of those CPs; they are enabled when
     * enableView is set by didInsertElement().
     * This will likely not be required when these values are migrated to a
     * shared service (data/ontology), which can be done once the requirements
     * are settled.
     */
    this.set('controlOptions.enableView', true);
  },

  // ---------------------------------------------------------------------------

  toggleVisibility(checked, ontologyId) {
    dLog('toggleVisibility', checked, this, arguments);
    if (ontologyId) {
      this.get('ontology').setOntologyIsVisible(ontologyId, checked);
    }
  },

  allVisible : false,
  allVisibleChanged(checked) {
    let
    ontologiesTree = this.get('ontologiesTree.content'),
    ontologyIds = this.get('controlOptions.showHierarchy') ?
      Object.keys(ontologiesTree) :
      ontologiesTree      
    ?.map((o) => ontologyIdFromIdText(o.name));
    dLog('allVisibleChanged', ontologyIds);
    if (ontologyIds) {
      ontologyIds.forEach((ontologyId) => {
        this.get('ontology').setOntologyIsVisible(ontologyId, checked);
      });
    }
  },


  noAction(value) {
    dLog('noAction', value);
  },

  // ---------------------------------------------------------------------------

  /** user has clicked on a enter-expander in an ontology tree. */
  selectOntologyNode(nodeText, values, event) {
    dLog('selectOntologyNode', nodeText, values, event.target);
    /** nodeText === values.name */
    let oc = this.ontologyCollation;
    if (oc) {
      oc.selectOntologyNode(nodeText, values, event);
    }
  },

  // ---------------------------------------------------------------------------

});

