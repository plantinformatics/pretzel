import Component from '@ember/component';
import { inject as service } from '@ember/service';

/**
 */
export default Component.extend({

  /** used for axisBrush.brushedAxes to instantiate axis-brush s. */
  flowsService: service('data/flows-collate'),

  classNames : [ 'axis-brushes' ],

});
