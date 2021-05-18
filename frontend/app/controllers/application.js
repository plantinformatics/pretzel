import { computed } from '@ember/object';
import Controller from '@ember/controller';
import config from '../config/environment';

import { parseOptions } from '../utils/common/strings';

const dLog = console.debug;

export default Controller.extend({
  actions: {
    transitionToLoginRoute() {
      this.transitionToRoute('login');
    }
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
  queryParams: [{options : {as : 'appOptions'}}],

  parsedOptions : computed('options', function () {
    let options = this.get('options'),
    parsedOptions = options && parseOptions(options);
    dLog('parsedOptions', options);
    return parsedOptions;
  })

});

