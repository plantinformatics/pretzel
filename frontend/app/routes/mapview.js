import Ember from 'ember';
import AuthenticatedRouteMixin from 'ember-simple-auth/mixins/authenticated-route-mixin';

const { RSVP: { Promise } } = Ember;
const { Route } = Ember;
const { inject: { service } } = Ember;
import { task } from 'ember-concurrency';


let config = {
  block: service('data/block'),
  dataset: service('data/dataset'),

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
   *  mapsToView : [ ]
   *  availableMapsTask : task -> [ id , ... ]  task completion also sets this.availableDatasets
   *  blockTasks : { id : task, ... }
   *
   * selectedMaps() is a filtered copy of params.mapsToView[] : maps in
   * params which are not chrs (blocks) in API result are filtered out, i.e.
   * store .query('dataset') .forEach() .get('blocks')
   * i.e. this case selected means viewed, whereas elsewhere
   * selected{Features,Markers,Blocks,Maps} means brushed; to be distinguished
   * in a separate commit.

   * selectedMaps is different to draw-map.js: oa.selectedAxes,
   * which is the brushed Axes (maps).
   */

  model(params) {

    // Get all available maps.
    let result;

    
    let datasetService = this.get('dataset');
    let taskGetList = datasetService.get('taskGetList');  // availableMaps
    let datasetsTask = taskGetList.perform(); // renamed from 'maps'
    this.get('getDatasets').perform(datasetsTask);

    let blockService = this.get('block');
    let taskGet = blockService.get('taskGet');

    console.log("mapview model", params.mapsToView);
    let blockTasks = params.mapsToView.map(
      function (id) {
        let blockTask = taskGet.perform(id);
        console.log("mapview model", id, blockTask);
        return blockTask;
      });
    let blockValues = this.get('mapsToViewObj') || this.set('mapsToViewObj', {}),
    getValue = this.get('getBlock');
    blockTasks.map(
      function (task) {
        getValue.perform(task, blockValues);
      });

    result =
      {
       mapsToView : params.mapsToView,
        availableMapsTask : datasetsTask, // task result is -> [ id , ... ]
        blockTasks : blockTasks,
       highlightFeature: params.highlightFeature
      };
    console.log("routes/mapview: model() result", result);
    return result;

  },


  getDatasets : task(function * (datasetsTask) {
    let datasets = yield datasetsTask;
    // console.log("getDatasets", datasets);
    this.set('availableDatasets', datasets);
    if (datasets.length)
    {
      let blocks = datasets[0].get('blocks').toArray();
      // console.log("getDatasets blocks", blocks, blocks[0].id);
    }
  }),

  getBlock : task(function * (blockTask, blockValues) {
    let block = yield blockTask;
    // console.log("getBlock", block.id, block);
    blockValues[block.id] = block;
  })


};

var args = [config]

if (window['AUTH'] !== 'NONE') {
  args.unshift(AuthenticatedRouteMixin);
}

export default Ember.Route.extend(...args);
