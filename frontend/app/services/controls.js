import Ember from 'ember';
import Service from '@ember/service';

import { stacks } from '../utils/stacks';

const dLog = console.debug;

/** Registry for user controls which are global in their effect.
 */
export default Service.extend(Ember.Evented, {

  /** this can change to a registry, e.g. 'view' for the view controls
   */
  controls : Ember.computed(function () {
    let oa = stacks.oa,
    /** This occurs after mapview.js: controls : Ember.Object.create({ view : {  } }),
     * and draw-map : draw() setup of  oa.drawOptions.
     */
    controls = oa.drawOptions.controls;
    dLog('controls', controls);
    return controls;
  }),
  view : Ember.computed.alias('controls.view')


});
