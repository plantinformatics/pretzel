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
    devel: {
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

    console.log("routes/mapview: model() result", result);
    return result;

  }
};

var args = [config]

if (window['AUTH'] !== 'NONE') {
  args.unshift(AuthenticatedRouteMixin);
}

export default Ember.Route.extend(...args);
