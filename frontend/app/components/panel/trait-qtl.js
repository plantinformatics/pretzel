import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { observer, computed } from '@ember/object';
import { alias } from '@ember/object/computed';

import { A as array_A } from '@ember/array';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/**
 * @param data  is trait.traits
 */
export default Component.extend({
  // trait : service('data/trait'),

  /*--------------------------------------------------------------------------*/

  displayData : alias('data'),

  /*--------------------------------------------------------------------------*/

  viewAllFlag : true,

  viewAll(checked) {
    /** at this point, .viewAllFlag has not been updated from the current click;
     * the passed in value is target.checked, which has been updated.
     */
    dLog('viewAll', checked, this, this.viewAllFlag);
    this.get('data').forEach((d) => d.set('visible', checked));
  }

  /*--------------------------------------------------------------------------*/

});
