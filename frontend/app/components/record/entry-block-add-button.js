import { inject as service } from '@ember/service';

import EntryBase from './entry-base';

import { ontologyIdFromIdText } from '../../utils/value-tree';

export default EntryBase.extend({
  ontology : service('data/ontology'),

  tagName: '',


  /*--------------------------------------------------------------------------*/
  actions : {
    loadBlock(block) {
      console.log('entry-block-add-button: loadBlock', block, arguments);
      this.sendAction('loadBlock', block);
      this.setOntologyVisible();
    }
  }, // actions
  /*--------------------------------------------------------------------------*/

  /** If this component is in explorer ontology tree, set as visible the
   * OntologyId which this component is within.
   */
  setOntologyVisible() {
    /** record/entry-* component */
    let entry = this, isTrait;
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
