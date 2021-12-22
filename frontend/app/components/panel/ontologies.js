import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';
import { computed } from '@ember/object';
import { A } from '@ember/array';

import { toPromiseProxy } from '../../utils/ember-devel';
import { unlinkDataIdChildrenTree, ontologyIdFromIdText } from '../../utils/value-tree';

// -----------------------------------------------------------------------------

const dLog = console.debug;



// -----------------------------------------------------------------------------

export default Component.extend({
  ontology : service('data/ontology'),

// alias('ontology.ontologyCollation'),
  ontologyCollation : computed('controlOptions.enableView', function () {
    let
    oc = this.controlOptions.enableView && this.get('ontology.ontologyCollation');
    dLog('ontologyCollation', oc, this.controlOptions.enableView, this);
    return oc;
  }),
  get blockFeatureOntologies() { return this.get('ontologyCollation.blockFeatureOntologies'); },
  ontologiesTree : computed(
    // 'ontologyCollation.ontologiesTree',  // has embedded datasets : parent / scope / block
    'controlOptions.enableView',
    'controlOptions.showHierarchy',
    'ontologyCollation.blockFeatureOntologiesTreeGrouped',
    'ontologyCollation.blockFeatureOntologiesName',
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
  blockFeatureOntologiesName : computed('ontologyCollation.blockFeatureOntologiesName', function () {
    const
    fieldName = 'Ontologies',
    boP = this.get('ontologyCollation.blockFeatureOntologiesName'),
    bofP = boP?.then(
      (bos) => bos.filter((blockTraits) => blockTraits[fieldName].length));
    return bofP && toPromiseProxy(bofP);
  }),
  /** Extract the unique Ontologies as an single array.
   * Filter for blocks which are currently viewed.
   * The term 'Ontology' might be reserved for the group of OntologyIDs, i.e. the ROOT;
   * the values here are OntologyIDs.
   */
  blockFeatureOntologiesNameFlat : computed('ontologyCollation.blockFeatureOntologiesName', function () {
    const
    fieldName = 'Ontologies',
    boP = this.get('ontologyCollation.blockFeatureOntologiesName'),
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
      (os) => os.map((o) => { o = {name : o};  this.levelMeta.set(o, 'trait'); return o; }));
    return omP && toPromiseProxy(omP);
  }),
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
      // ontologyCollation.blockFeatureOntologiesTreeGrouped ?

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
      treeP = oc.get('blockFeatureOntologiesTreeEmbedded'),
      id2nP = oc.get('ontologyId2Node'),
      id2PnP = this.get('blockFeatureOntologiesViewedIds'),  // was ontologyId2DatasetNodes
      promise = Promise.all([treeP, id2nP, id2PnP]).then(([tree, id2n, id2Pn]) => {
        dLog(fnName, tree, id2n, 'id2Pn', id2Pn);
        /** convert array to Object, which treeFor() expects. */
        id2Pn = id2Pn.reduce((result, oid) => {result[oid] = true; return result;}, {});
        let
        /** treeFor() will move to utils/data/grouping.js */
        treeFor = oc.treeFor,
        valueTree = treeFor(this.get('levelMeta'), tree, id2n, id2Pn);
        /** treeFor() makes a copy so it is not necessary for unlinkDataIdChildrenTree() to make a copy. */
        unlinkDataIdChildrenTree(valueTree);
        this.levelMeta.set(valueTree, {typeName : 'term', name : 'CO'});

        dLog(fnName, valueTree);
        return valueTree;
      });

      let proxy = toPromiseProxy(promise);
      return proxy;
  }),
  // blockFeatureOntologiesTree : alias('ontologyCollation.blockFeatureOntologiesTree'),
  // blockFeatureOntologiesTreeGrouped : alias('ontologyCollation.blockFeatureOntologiesTreeGrouped'),
  levelMeta : alias('ontologyCollation.levelMeta'),


  // ---------------------------------------------------------------------------

  controlOptions : {
    enableView : false,
    showHierarchy : true,
  },
  showHierarchyChanged(value) {
    dLog('showHierarchyChanged', value);
  },

  // ---------------------------------------------------------------------------

  noAction(value) {
    dLog('noAction', value);
  },

  // ---------------------------------------------------------------------------

  /** user has clicked on a enter-expander in an ontology tree. */
  selectOntologyNode(nodeText, values, event) {
    dLog('selectOntologyNode', nodeText, values, event.target);
    let ontologyId = values?.id;
    if (ontologyId) {

    }
  },

  // ---------------------------------------------------------------------------

});

