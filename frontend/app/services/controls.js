import { alias } from '@ember/object/computed';
import { computed } from '@ember/object';
import Evented from '@ember/object/evented';
import Service from '@ember/service';
import { inject as service } from '@ember/service';

import { pick } from 'lodash/object';

import { stacks } from '../utils/stacks';

const dLog = console.debug;

/** Registry for user controls which are global in their effect.
 */
export default Service.extend(Evented, {
  apiServers : service(),

  window : alias('view.controls.window'),
  /**
   *    ontologyClick : string : 'Level', ''Hierarchy'
   */
  viewed2 : {},

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

  /** @return the current values of the user genotype controls which filter SNPs
   */
  genotypeSNPFilters : computed(
    'userSettings.genotype.mafThreshold',
    'userSettings.genotype.snpPolymorphismFilter',
    'userSettings.genotype.featureCallRateThreshold',
    'userSettings.genotype.minAlleles',
    'userSettings.genotype.maxAlleles',
    'userSettings.genotype.typeSNP',
    function () {
      const
      genotypeSNPFilterNames =  [
        'mafThreshold', 'snpPolymorphismFilter', 'featureCallRateThreshold',
        'minAlleles', 'maxAlleles', 'typeSNP',
      ],
      userSettings = this.userSettings.genotype,
      /** Don't pass values which are default, so they are not used in cacheIdOptions. */
      userOptions = {}; // pick(this.userSettings.genotype, genotypeSNPFilterNames);
      pickNonDefault(userOptions, userSettings, ['snpPolymorphismFilter', 'typeSNP'], false);
      pickNonDefault(userOptions, userSettings, ['mafThreshold', 'featureCallRateThreshold'], 0);
      pickNonDefault(userOptions, userSettings, ['minAlleles', 'maxAlleles'], '');

      return userOptions;
    }),

  //----------------------------------------------------------------------------

});

/** Like lodash.pick(), but pick only values which have a non-default value.
 */
function pickNonDefault(target, source, fieldNames, defaultValue) {
  fieldNames.forEach(name => {
    if (source[name]) {
      target[name] = source[name];
    } } );
}
