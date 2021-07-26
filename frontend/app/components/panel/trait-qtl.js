import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { observer, computed } from '@ember/object';
import { alias } from '@ember/object/computed';

import { A as array_A } from '@ember/array';


/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

export default Component.extend({
  trait : service('data/trait'),

  /*--------------------------------------------------------------------------*/

  displayData : alias('trait.traits'),


  /*--------------------------------------------------------------------------*/

});
