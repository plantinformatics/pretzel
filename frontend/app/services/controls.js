import { alias } from '@ember/object/computed';
import { computed } from '@ember/object';
import Evented from '@ember/object/evented';
import Service from '@ember/service';

import { stacks } from '../utils/stacks';

const dLog = console.debug;

/** Registry for user controls which are global in their effect.
 */
export default Service.extend(Evented, {

  /** this can change to a registry, e.g. 'view' for the view controls
   */
  controls : computed(function () {
    let oa = stacks.oa,
    /** This occurs after mapview.js: controls : Ember.Object.create({ view : {  } }),
     * and draw-map : draw() setup of  oa.drawOptions.
     */
    controls = oa.drawOptions.controls;
    dLog('controls', controls);
    return controls;
  }),
  view : alias('controls.view')


});
