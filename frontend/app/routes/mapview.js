import Ember from 'ember';
import AuthenticatedRouteMixin from 'ember-simple-auth/mixins/authenticated-route-mixin';

const { RSVP: { Promise } } = Ember;
const { Route } = Ember;
const { inject: { service } } = Ember;
import { task } from 'ember-concurrency';
import EmberObject from '@ember/object';


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
    
    let datasetService = this.get('dataset');
    let taskGetList = datasetService.get('taskGetList');  // availableMaps
    let datasetsTask = taskGetList.perform(); // renamed from 'maps'

    let blockService = this.get('block');
    let getBlocks = blockService.get('getBlocks');
    let viewedBlocksTasks = getBlocks.apply(blockService, [params.mapsToView]);

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
      console.log(referenceBlockIds);
      /** could add this task list to result; not required yet. */
      let viewedBlockReferencesTasks = getBlocks.apply(blockService, [referenceBlockIds]);
    });

    console.log("routes/mapview: model() result", result);
    return result;

  }
};

var args = [config]

if (window['AUTH'] !== 'NONE') {
  args.unshift(AuthenticatedRouteMixin);
}

export default Ember.Route.extend(...args);
