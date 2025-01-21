import { inject as service } from '@ember/service';
import { later } from '@ember/runloop';

import EntryBase from './entry-base';

import { valueGetType, ontologyIdFromIdText } from '../../utils/value-tree';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default EntryBase.extend({
  trait : service('data/trait'),
  ontology : service('data/ontology'),

  tagName: '',


  /*--------------------------------------------------------------------------*/
  actions : {
    loadBlock(block) {
      const viewed = block.isViewed;
      console.log('entry-block-add-button: loadBlock', block, arguments, viewed);
      this.loadBlock(block);
      /* loadBlock() is a toggle (since 137c3662); the following is required
       * when block is becoming viewed. */
      if (! viewed) {
        /** these 2 functions each determine if this button is within the explorer
         * Trait or Ontology tab, and only the corresponding function will take an
         * action. */
        this.setTraitVisible(block);
        this.setOntologyVisible(block);
        this.get('ontology').ensureVisibleOntologiesAreColoured();
        later(() => this.get('ontology').ensureVisibleOntologiesAreColoured(), 3000);
      }
    }
  }, // actions
  /*--------------------------------------------------------------------------*/

  /** If this component is in explorer trait tree, set as visible the
   * TraitId which this component is within.
   */
  setTraitVisible(block) {
    /** record/entry-* component */
    let entry = this;
    /** Both this function and setOntologyVisible() use component-tree lookup to
     * determine if the tab is (explorer) Trait or Ontology, and what the
     * traitName / OntologyId is; a more general solution could utilise meta as
     * in ontologyIdToValue() : checkbox
     */
    /** highest entry with type 'Parent' */
    let parent;
    while (entry) {
      let v, levelMeta;
      if ((v = entry.values) && 
          (levelMeta = entry.levelMeta)) {
        /** meta type of entry */
        let t = valueGetType(levelMeta, v);
        if (t === 'Parent') { parent = entry; }
      }
      entry = entry.parentView;
    }

    let traitName = parent?.parentView?.name;

    if (traitName) {
      dLog('setTraitVisible', traitName, parent);
      /** This will also add traitName as required. */
      this.get('trait').traitVisible(traitName, true);
      this.collateOT(block, traitName, undefined);
    }
  },

  /** If this component is in explorer ontology tree, set as visible the
   * OntologyId which this component is within.
   */
  setOntologyVisible(block) {
    /** record/entry-* component */
    let
    entry = this,
    /** isTrait indicates if the Ontologyid has .type 'trait' or 'term', i.e. leaf or node. */
    isTrait;
    while (
      entry.parentView &&
        !((isTrait = entry?.values && (entry?.levelMeta?.get(entry?.values) == 'trait')))    ) {
      // dLog(entry._debugContainerKey, entry?.values);
      entry = entry.parentView;
    }
    if (isTrait) {
      let
      values = entry.values,
      ontologyId = values.id ||
      (values.name && ontologyIdFromIdText(values.name));
      this.get('ontology').setOntologyIsVisible(ontologyId, true);
      this.collateOT(block, undefined, ontologyId);
    }
  },
  /** Collate the ontology or trait values of features in the block which match
   * the given a trait or ontology.
   *
   * When the user adds a block from Explorer Trait tab, the Ontologies of QTLs
   * (features) in the block which match the branch Trait are made visible.
   * And vice versa, for Ontology / Trait.
   *
   * @param block block which is being viewed
   * @param traitName, ontologyId one of these is !== undefined
   */
  collateOT(block, traitName, ontologyId) {
    const
    fnName = 'collateOT',
    /** match this value */
    value = traitName || ontologyId,
    fields = ['Trait', 'Ontology'],
    /** true if adding from Trait tab of explorer */
    fromTrait = !!traitName,
    /** field name of explorer tab */
    fromField = fields[+!fromTrait],
    otherField = fields[+fromTrait];
    dLog(fnName, block.id, traitName, ontologyId, value, fromTrait, fromField, otherField);
    block.get('allFeatures').then((features) => {
      dLog(fnName, features.length);
    let
    valueSet = block.get('features').reduce((result, feature) => {
      if (feature.get('values.' + fromField) == value) {
        result.add(feature.get('values.' + otherField));
      }
      return result;
    }, new Set()),
    values = Array.from(valueSet.keys());
    dLog(fnName, values);
    values.forEach(
      (value) => fromTrait ?
        this.get('ontology').setOntologyIsVisible(value, true) :
        this.get('trait').traitVisible(value, true) );
    });
  },

});
