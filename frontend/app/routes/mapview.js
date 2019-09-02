import Ember from 'ember';
import AuthenticatedRouteMixin from 'ember-simple-auth/mixins/authenticated-route-mixin';

const { RSVP: { Promise } } = Ember;
const { Route } = Ember;
const { inject: { service } } = Ember;
import { task } from 'ember-concurrency';
import EmberObject from '@ember/object';

import { parseOptions } from '../utils/common/strings';


let config = {
  dataset: service('data/dataset'),
  block: service('data/block'),

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

  /** Ember-concurrency tasks are returned in the model :
   *  availableMapsTask : task -> [ id , ... ]
   *  blockTasks : { id : task, ... }
   */

  model(params) {

    // Get all available maps.
    let result;

    let me = this;
    
    if (params.options)
      params.parsedOptions = parseOptions(params.options);

    let datasetService = this.get('dataset');
    let taskGetList = datasetService.get('taskGetList');  // availableMaps
    let datasetsTask = taskGetList.perform(); // renamed from 'maps'

    let blockService = this.get('block');
    let allInitially = params.parsedOptions && params.parsedOptions.allInitially;
    let getBlocks = blockService.get('getBlocks' + (allInitially ? '' : 'Summary'));
    let viewedBlocksTasks = (params.mapsToView && params.mapsToView.length) ?
      getBlocks.apply(blockService, [params.mapsToView]) : Ember.RSVP.cast([]);

    result = EmberObject.create(
      {
        params : params,
        availableMapsTask : datasetsTask, // task result is -> [ id , ... ]
        viewedBlocks : viewedBlocksTasks
      });

    /* When the datasets result (actually the blocks) is received, use that
     * information to determine if any of params.mapsToView[] have reference
     * blocks, and if so, add them to the view.
     */
    datasetsTask.then(function (blockValues) {
      console.log('datasetsTask then', blockValues);
      // blockValues[] are all available blocks
      let referenceBlocks =
      params.mapsToView.reduce(function (result, blockId) {
        /** same as controllers/mapview.js:blockFromId(), maybe factor to a mixin. */
        let store = me.get('store'),
        block = store.peekRecord('block', blockId);
        let referenceBlock = block && block.get('referenceBlock');
        if (referenceBlock)
          result.push(referenceBlock);
        return result;}, []),
      referenceBlockIds = referenceBlocks.map(function (block) { return block.get('id'); });
      console.log('referenceBlockIds', referenceBlockIds);
      /* currently getBlocksSummary() just gets the featureCount, which for a
       * reference block is 0, so this step could be skipped if ! allInitially,
       * but later the summary may contain other information */
      /** could add this task list to result; not required yet. */
      let viewedBlockReferencesTasks = referenceBlockIds.length ?
        getBlocks.apply(blockService, [referenceBlockIds]) : Ember.RSVP.cast([]);
    });

    console.log("routes/mapview: model() result", result);
    return result;

  },

  /** Add body class, as in example :
   * discuss.emberjs.com/t/changing-the-body-class-for-a-specific-route/6331
   * Could instead use : github.com/stonecircle/ember-body-class
   */
  activate: function() {
    this._super();
    Ember.$('body').toggleClass("mapview");
  },
  deactivate: function() {
    this._super();
    Ember.$('body').toggleClass("mapview");
  }


};

var args = [config]

if (window['AUTH'] !== 'NONE') {
  args.unshift(AuthenticatedRouteMixin);
}

export default Ember.Route.extend(...args);
