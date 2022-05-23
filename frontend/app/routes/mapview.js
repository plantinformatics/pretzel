import $ from 'jquery';
import { inject as service } from '@ember/service';
import Route from '@ember/routing/route';
import RSVP, { Promise } from 'rsvp';
import AuthenticatedRouteMixin from 'ember-simple-auth/mixins/authenticated-route-mixin';

import { task } from 'ember-concurrency';
import EmberObject from '@ember/object';

import ENV from '../config/environment';
import { parseOptions } from '../utils/common/strings';

const dLog = console.debug;

let config = {
  dataset: service('data/dataset'),
  block: service('data/block'),
  queryParamsService: service('query-params'),
  auth: service('auth'),
  apiServers: service(),

  authenticationRoute: 'login',

  titleToken: 'MapView',
  queryParams: {
    mapsToView: {
      // The initial architecture (up until feature/render-promises) was for changes in the URL mapsToView query parameter to trigger
      // a model refresh, using :
      // refreshModel: true
      //
      /* Now : model() initiates tasks via the block service which on completion
       * trigger event receivedBlock, which is listened for by draw-map, calling
       * receiveChr().
       */
      replace : true
    },
    chr: {
      refreshModel: true
    },
    highlightFeature: {
      refreshModel: false
    },
    options: {
      refreshModel: false
    }
  },

  serializeQueryParam: function(value, urlKey, defaultValueType) {
    // This serializes what gets passed to the link-to query parameter.
    // Without it, an array simply gets JSON.stringified, for example:
    // [1,2] becomes "[1,2]" and treated as a string.
    if (defaultValueType === 'array') {
      return value;
    }
    return '' + value;
  }, 

  deserializeQueryParam: function(value, urlKey, defaultValueType) {
    return value;
  },

  getHoTLicenseKey() {
    if (! ENV.handsOnTableLicenseKey) {
      this.get('auth').runtimeConfig().then((config) => {
        dLog('getHoTLicenseKey', config, ENV);
        ENV.handsOnTableLicenseKey = config.handsOnTableLicenseKey;
      });
    }
  },


  /** Ember-concurrency tasks are returned in the model :
   *  availableMapsTask : task -> [ id , ... ]
   *  viewedBlocks : allinitially ? (blockTasks : { id : task, ... }) : single task for getBlocksSummary().
   */

  model(paramsIn) {

    // Get all available maps.
    let result;

    let me = this;
    
    let blockService = this.get('block');
    /** blockService supports in computing the model. */
    let params = this.get('queryParamsService').get('params');
    dLog('paramsIn', paramsIn, params, paramsIn.mapsToView, params.mapsToView);

    if (JSON.stringify(params) != JSON.stringify(paramsIn)) {
      /** Object.assign(params, paramsIn) would be equivalent, but it gets a warning :
       * "... attempted to update <Ember.Object:...>.mapsToView to "", but it is being tracked by a tracking context, ..."
       */
      Object.keys(paramsIn).forEach((key) => params.set(key, paramsIn[key]));
      dLog('params', params, params.mapsToView);
    }

    if (params.options)
      params.parsedOptions = parseOptions(params.options);

    this.getHoTLicenseKey();

    let datasetsTask;
    if (false)
    {
    let datasetService = this.get('dataset');
    let taskGetList = datasetService.get('taskGetList');  // availableMaps
      /** this will pass server undefined, and
       * services/data/dataset:taskGetList() will use primaryServer. */
      datasetsTask = taskGetList.perform() // renamed from 'maps'
        .catch((err) => {dLog('model taskGetList', err, this); debugger; return []; });
    }
    else
    {
      let apiServers = this.get('apiServers'),
      primaryServer = apiServers.get('primaryServer');
      datasetsTask =
        primaryServer.getDatasets()
        .catch((err) => {dLog('model taskGetList', err, this); debugger; return []; });
    }

    // this.controllerFor(this.fullRouteName).setViewedOnly(params.mapsToView, true);

    let blocksLimitsTask = this.get('blocksLimitsTask');
    dLog('blocksLimitsTask', blocksLimitsTask);
    if (! blocksLimitsTask ||
        (! Array.isArray(blocksLimitsTask._result) &&
         (! blocksLimitsTask.get || ! blocksLimitsTask.get('isRunning')))) {
      blocksLimitsTask = blockService.getBlocksLimits(undefined, {server: 'primary'});
      this.set('blocksLimitsTask', blocksLimitsTask);
    }
    let allInitially = params.parsedOptions && params.parsedOptions.allInitially;
    let getBlocks = blockService.get('getBlocks' + (allInitially ? '' : 'Summary'));
    let viewedBlocksTasks = (params.mapsToView && params.mapsToView.length) ?
      getBlocks.apply(blockService, [params.mapsToView]) : RSVP.cast([]);

    result = EmberObject.create(
      {
        params : params,
        availableMapsTask : datasetsTask, // task result is -> [ id , ... ]
        viewedBlocks : viewedBlocksTasks,
        viewedById : blockService.get('viewedById')
      });

    /* When the datasets result (actually the blocks) is received, use that
     * information to determine if any of params.mapsToView[] have reference
     * blocks, and if so, add them to the view.
     */
    datasetsTask.then(function (blockValues) {
      dLog('datasetsTask then', blockValues);
      // blockValues[] are all available blocks
      let referenceBlocks =
      params.mapsToView.reduce(function (result, blockId) {
        /** same as controllers/mapview.js:blockFromId(), maybe factor to a mixin. */
        let
          /** store will be undefined if blockId is invalid or belongs to a
           * secondary server which is not yet connected. */
          store = me.get('apiServers').id2Store(blockId),
        block = store && store.peekRecord('block', blockId);
        let referenceBlock = block && block.get('referenceBlock');
        if (referenceBlock)
          result.push(referenceBlock);
        return result;}, []),
      referenceBlockIds = referenceBlocks.map(function (block) { return block.get('id'); });
      if (referenceBlockIds.length) {
        dLog('referenceBlockIds adding', referenceBlockIds);
        blockService.setViewed(referenceBlockIds, true);
      }
      /* currently getBlocksSummary() just gets the featureCount, which for a
       * reference block is 0, so this step could be skipped if ! allInitially,
       * but later the summary may contain other information */
      /** could add this task list to result; not required yet. */
      let viewedBlockReferencesTasks = referenceBlockIds.length ?
        getBlocks.apply(blockService, [referenceBlockIds]) : RSVP.cast([]);
    });

    dLog("routes/mapview: model() result", result);
    return result;

  },

  /** Add body class, as in example :
   * discuss.emberjs.com/t/changing-the-body-class-for-a-specific-route/6331
   * Could instead use : github.com/stonecircle/ember-body-class
   */
  activate: function() {
    this._super();
    $('body').toggleClass("mapview");
  },
  deactivate: function() {
    this._super();
    $('body').toggleClass("mapview");
  }


};

var args = [config]

if (window['AUTH'] !== 'NONE') {
  args.unshift(AuthenticatedRouteMixin);
}

export default Route.extend(...args);
