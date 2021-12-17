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
  window : alias('view.controls.window'),

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
  }),

  /*--------------------------------------------------------------------------*/

  /** starting with bucketFill mode, Pretzel GUI may define modes, in which :
   * - the cursor is changed to a different symbol (e.g. paint bucket pouring)
   *   over specific elements (e.g. synteny blocks) within the graph area,
   * - left-mouse click has an action defined by the mode (e.g. set colour of
   *   the clicked graphic element / synteny block)
   * - other click actions within the graphic area are disabled
   * - navigation without mouse clicking is not affected, i.e. mousewheel zoom and pan.
   * - operations in the left and right panel, outside the graph area, are unaffected.
   *
   * The initial default value of guiMode is undefined, which means there is no
   * current GUI mode, i.e. the normal click operations are enabled.
   */
  guiMode : undefined,
  guiModes : { bucketFill : 'bucketFill'},
  noGuiModeFilter : computed( function () {
    return () => {
      return this.guiMode === undefined; 
    };
  }),

  /*--------------------------------------------------------------------------*/

});
