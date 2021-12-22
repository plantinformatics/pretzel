import Component from '@ember/component';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';

import { ontologyIdFromIdText } from '../../utils/value-tree';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

export default Component.extend({
  ontology : service('data/ontology'),

  // ---------------------------------------------------------------------------

  ontologyId : computed('name', function () {
    return ontologyIdFromIdText(this.name);
  }),

  // ---------------------------------------------------------------------------

  didReceiveAttrs () {
    this._super(...arguments);
    this.initialOntologyIsVisible();
  },

  // ---------------------------------------------------------------------------

  initialOntologyIsVisible() {
    let
    ontologyId = this.ontologyId,
    checked = this.get('ontology').getOntologyIsVisible(ontologyId);
    dLog('initialOntologyIsVisible', this.name, ontologyId, checked);
    this.set('ontologyIsVisible', checked);
  },

  ontologyIsVisible : undefined,
  ontologyIsVisibleChanged(checked) {
    let ontologyId = this.ontologyId;
    dLog('ontologyIsVisibleChanged', this.name, ontologyId, checked, this);
    this.set('ontologyIsVisible', checked);
    this.get('ontology').setOntologyIsVisible(ontologyId, checked);
  },

  // ---------------------------------------------------------------------------

});

