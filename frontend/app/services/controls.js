import { alias } from '@ember/object/computed';
import { computed } from '@ember/object';
import Evented from '@ember/object/evented';
import Service from '@ember/service';
import { inject as service } from '@ember/service';

import { stacks } from '../utils/stacks';

const dLog = console.debug;

/** Registry for user controls which are global in their effect.
 */
export default Service.extend(Evented, {
  apiServers : service(),

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
  view : alias('controls.view'),

  /** @return the api server indicated by the tab currently selected
   * by the user (serverTabSelected), or primaryServer if tab not
   * changed.
   * @desc
   * Used for featureSearch and dnaSequenceSearch which don't have a
   * block param to use to select apiServer.
   */
  apiServerSelectedOrPrimary : computed('serverTabSelected', function () {
    // factored from components/goto-feature-list.js:blocksUnique() . (taskGet getBlocksOfFeatures)
    let
    serverTabSelectedName = this.get('serverTabSelected'),
    serverTabSelected = serverTabSelectedName && this.get('apiServers').lookupServerName(serverTabSelectedName),
    apiServer = serverTabSelected || this.get('apiServers.primaryServer');
    return apiServer;
  })

});
