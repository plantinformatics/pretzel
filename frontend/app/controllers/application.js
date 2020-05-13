import Ember from 'ember';
const {
  inject: { service },
  Controller,
} = Ember;

import { parseOptions } from '../utils/common/strings';

const dLog = console.debug;

export default Controller.extend({
  auth: service(),
  init() {
    this._super(...arguments);
  },

  /** usage e.g. ?appOptions=individual
   * or options=individual
   *
   * Using just options=individual will also add &appOptions=individual when
   * MapViewer link is clicked; it may be better to simply use queryParams :
   * ['appOptions'], avoiding the complication with 'options'
   * Note : mapview uses '?options'. so using 'options' here gets error :
   * "... cannot have more than one controller property map to the same query
   * param key."
   */
  queryParams: [{ options: { as: 'appOptions' } }],

  parsedOptions: Ember.computed('options', function() {
    let options = this.get('options'),
      parsedOptions = options && parseOptions(options);
    dLog('parsedOptions', options);
    return parsedOptions;
  }),
});
