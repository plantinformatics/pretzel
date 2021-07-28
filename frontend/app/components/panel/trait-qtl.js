import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { observer, computed } from '@ember/object';
import { alias } from '@ember/object/computed';

import { A as array_A } from '@ember/array';

import {
  traitColour
} from '../../utils/draw/axis';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/**
 * @param data  is trait.traits
 */
export default Component.extend({
  // trait : service('data/trait'),

  /*--------------------------------------------------------------------------*/

  displayData : computed('data.[]', function () {
    let data = this.get('data')
        .map((t) => ({
          colour : traitColour(t.name),
          ... t
        }));
    return data;
  }),


  /*--------------------------------------------------------------------------*/

});
