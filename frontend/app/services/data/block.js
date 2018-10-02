import Ember from 'ember';
import Service from '@ember/service';
import { task } from 'ember-concurrency';

const { inject: { service } } = Ember;

let trace_block = 1;

/** Augment the store blocks with features to support mapview.
 * In particular, add an `isViewed` attribute to blocks, which indicates that
 * the block is viewed in the mapview.
 *
 *  It is possible that later there will be multiple mapviews in one route, in
 *  which case the isViewed state might be split out of this singleton service,
 *  or this may become a per-mapview component.
 * 
 */
export default Service.extend(Ember.Evented, {
    auth: service('auth'),
    store: service(),
  apiEndpoints: service('api-endpoints'),

  /** Not required because findRecord() is used;
   * might later want this for other requests or calculation results, but can
   * discard it.
   */
  push : function (id, block) {
    console.log('block push', block);
    let pushData = 
      {
        data: {
          id: id,
          type: 'block',
          attributes: block
        }
      };
    // silently fails to return
    this.get('store').push(pushData);
  },

  /** Call getData() in a task - yield the block result.
   * Signal that receipt with receivedBlock(id, block).
   */
  taskGet: task(function * (id) {
    /** if not already loaded and viewed, then trigger receivedBlock */
    let isViewed = this.get('getIsViewed').apply(this, [id]);
    let block = yield this.getData(id);
    // console.log('taskGet', this, id, block);
    if (! isViewed)
    {
      block.set('isViewed', true);
      this.trigger('receivedBlock', id, block);
    }
    return block;
  }),
  getData: function (id) {
    // console.log("block getData", id);
    let store = this.get('store');
    let endpoint = this.blockEndpoint(id),
    apiEndpoints = this.get('apiEndpoints'),
    adapterOptions =
      {
        filter: {include: "features"}
      };
    if (endpoint)
      adapterOptions = apiEndpoints.addId(endpoint, adapterOptions);
    let blockP = store.findRecord(
      'block', id,
      { reload: true,
        adapterOptions: adapterOptions}
    );

    return blockP;
  }  // allow multiple in parallel - assume id-s are different
  // later can use ember-contextual-service to give each id its own task scheduler
  ,
  /*--------------------------------------------------------------------------*/

  /** @return the block record handle if the block is loaded into the store from the backend.
   */
  peekBlock(blockId)
  {
    let store = this.get('store'),
    block = store.peekRecord('block', blockId);
    return block;
  },

  /*--------------------------------------------------------------------------*/

  /** Get the API host from which the block was received, from its dataset meta,
   * and lookup the endpoint from the host.
   * @return endpoint ApiEndpoint, or undefined.
   */
  blockEndpoint(blockId)
  {
    let
    block = this.peekBlock(blockId),
    datasetId = block && block.get('datasetId'), 
    dataset = datasetId && datasetId.get('content'),
    host = dataset && dataset.get('meta.apiHost'),
    apiEndpoints = this.get('apiEndpoints'),
    endpoint = apiEndpoints.lookupEndpoint(host);
    console.log('blockEndpoint', block, dataset, host, endpoint);
    return endpoint;
  },

  /** @return true if the 2 blocks are received from the same API host endpoint. */
  blocksSameEndpoint(blockA, blockB)
  {
    /* the object ID of 2 objects from the same mongodb will have a number of leading digits in common.  */
    let a = this.blockEndpoint(blockA),
    b = this.blockEndpoint(blockB);
    return a === b;
  },

  /*--------------------------------------------------------------------------*/

  /** @return true if the block is loaded into the store from the backend, and has .isViewed==true.
   */
  getIsViewed(blockId)
  {
    let store = this.get('store'),
    block = store.peekRecord('block', blockId),
    isViewed = block && block.get('isViewed');
    return isViewed;
  },

  /*--------------------------------------------------------------------------*/

  /**
   * The GUI does not provide a way for the user to unview a block which is not currently loaded.
   *
   * alternative implementation : mixins/viewed-blocks.js : @see setViewed()
   *
   * If viewed && unviewChildren && this block doesn't have .namespace then
   * search the loaded blocks for blocks which reference the block being
   * unviewed, and mark them as unviewed also.
   * @param unviewChildren
   *
   * @return define a task
   */
  setViewedTask: task(function * (id, viewed, unviewChildren) {
    console.log("setViewedTask", id, viewed, unviewChildren);
    let getData = this.get('getData');
    /* -  if ! viewed then no need to getData(), just Peek and if not loaded then return.
     * The GUI only enables viewed==false when block is loaded, so that difference is moot.
     */
    let block = yield getData.apply(this, [id]);
    console.log('setViewedTask', this, id, block);
    if (block.get('isViewed') && ! viewed && unviewChildren)
    {
      let maybeUnview = this.get('loadedViewedChildBlocks'),
      isChildOf = this.get('isChildOf'),
      toUnview = maybeUnview.filter(function (dataBlock) {
        return isChildOf(dataBlock, block);
      });
      console.log('setViewedTask', /*maybeUnview,*/ toUnview
                  .map(function(blockR) { return blockR.view.longName(); }) );
      toUnview.forEach(function (childBlock) {
        childBlock.set('isViewed', viewed);
      });
    }
    block.set('isViewed', viewed);
    // this.trigger('receivedBlock', id, block);  // not required now ?
  }),

  /** @return true if dataBlock is a child of block.
   * i.e. dataBlock.dataset.parent.id == block.dataset.id
   * and dataBlock.scope == block.scope
   */
  isChildOf(dataBlock, block) {
    let d = block.get('id'), d2 = dataBlock.get('id'), a = dataBlock,
    dataset = block.get('datasetId'), ad = dataBlock.get('datasetId');
    let match = 
      (d != d2) &&  // not self
      /* ! a.parent &&*/
      ad && (ad.get('parent').get('id') === dataset.get('id')) &&
      (dataBlock.get('scope') == block.get('scope'));
    if (trace_block > 1)
      console.log(
        'isChildOf', match, dataBlock, block, d, d2, dataset, ad, 
        dataBlock.get('scope'), block.get('scope'),
        dataBlock.view.longName(), block.view.longName()
    );
    return match;
  },

  /*--------------------------------------------------------------------------*/

  getBlocks(blockIds) {
    let taskGet = this.get('taskGet');
    console.log("getBlocks", blockIds);
    let blockTasks = blockIds.map(
      function (id) {
        let blockTask = taskGet.perform(id);
        console.log("mapview model", id, blockTask);
        return blockTask;
      });

    console.log("getBlocks() result blockTasks", blockTasks);
    return blockTasks;
  },

  /*--------------------------------------------------------------------------*/


  /** @return block records */
  blockValues: Ember.computed(function() {
    let records = this.get('store').peekAll('block');
    if (trace_block)
      console.log('blockValues', records);
    return records;
  }),
  selected: Ember.computed(
    'blockValues.@each.isSelected',
    function() {
      let records = this.get('blockValues')
        .filterBy('isSelected', true);
      if (trace_block)
        console.log('selected', records);
      return records;  // .toArray()
    }),
  viewed: Ember.computed(
    'blockValues.@each.isViewed',
    function() {
      let records = this.get('blockValues')
        .filterBy('isViewed', true);
      if (trace_block)
        console.log('viewed', records);
      return records;  // .toArray()
    }),
  viewedIds: Ember.computed(
    'viewed.[]',
    function() {
      let ids = this.get('viewed');
      if (trace_block > 1)
        ids.map(function (a) { console.log('viewedIds', a, a.get('id')); } );
      if (trace_block)
        console.log('viewedIds', ids);
      ids = ids.map(function (a) { return a.get('id'); } );
      if (trace_block)
        console.log('viewedIds', ids);

      return ids;
    })
  ,
  /*----------------------------------------------------------------------------*/


  /** Search for the named features, and return also their blocks and datasets.
   */
  getBlocksOfFeatures : task(function* (featureNames) {
    let me = this, blocks =
      yield this.get('auth').featureSearch(featureNames, /*options*/{});

    return blocks;
  }),


  /** @return array of blocks */
  loadedViewedChildBlocks: Ember.computed(
    'viewed.[]',
    function() {
      let records =
        this.get('viewed')
        .filter(function (block) {
          return block.get('namespace'); // i.e. !== undefined
        });
      if (trace_block > 1)
        console.log(
          'get', records
            .map(function(blockR) { return blockR.view.longName(); })
        );
      return records;  // .toArray()
    })
});
