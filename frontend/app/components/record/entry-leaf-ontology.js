import Component from '@ember/component';
import { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
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

  nodeName : alias('name'),

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

  valuesColour : computed('values', 'ontology.ontologyColourScaleUpdateCount', function () {
    let
    /** values.id is not defined, but can also use : values?.name && ontologyIdFromIdText(values.name)
     * as in manage-explorer : selectOntologyNode()
     */
    ontologyId = this.ontologyId,
    colour = ontologyId && this.get('ontology').ontologyIdToColour(ontologyId);
    return colour;
  }),

  // ---------------------------------------------------------------------------

});

