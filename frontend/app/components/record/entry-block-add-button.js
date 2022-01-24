import { inject as service } from '@ember/service';

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
      console.log('entry-block-add-button: loadBlock', block, arguments);
      this.sendAction('loadBlock', block);
      /** these 2 functions each determine if this button is within the explorer
       * Trait or Ontology tab, and only the corresponding function will take an
       * action. */
      this.setTraitVisible();
      this.setOntologyVisible();
    }
  }, // actions
  /*--------------------------------------------------------------------------*/

  /** If this component is in explorer trait tree, set as visible the
   * TraitId which this component is within.
   */
  setTraitVisible() {
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
    }
  },

  /** If this component is in explorer ontology tree, set as visible the
   * OntologyId which this component is within.
   */
  setOntologyVisible() {
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
    }
  },

});
