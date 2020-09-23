import Ember from 'ember';

const { inject: { service } } = Ember;

/**
 */
export default Ember.Component.extend({

	/** used for axisBrush.brushedAxes to instantiate axis-brush s. */
  flowsService: service('data/flows-collate'),

});
