import { isArray } from '@ember/array';
import { later } from '@ember/runloop';
import { resolve, Promise } from 'rsvp';
import { computed, get } from '@ember/object';
import { alias, filterBy } from '@ember/object/computed';
import Evented from '@ember/object/evented';
import Ember from 'ember';
import Service, { inject as service } from '@ember/service';
import { task, didCancel } from 'ember-concurrency';

import { keyBy } from 'lodash/collection';

//------------------------------------------------------------------------------

import { stacks } from '../../utils/stacks';
import { intervalSize, truncateMantissa }  from '../../utils/interval-calcs';
import { featuresCountsResultSum } from '../../utils/draw/featuresCountsResults';
import { breakPoint } from '../../utils/breakPoint';
import { findResult } from '../../utils/common/arrays';

//------------------------------------------------------------------------------

let trace_block = 1;
const dLog = console.debug;
/** trace the (array) value or just the length depending on trace level. */
function valueOrLength(value) { return (trace_block > 1) ? value : value.length; }

const draw_orig = false;

/*----------------------------------------------------------------------------*/

/** @return some value identifying the block, suitable for logging. */
function block_text(block) { return block && (block.view ? block.view.longName() : block.id || block); }
/** log a Map block -> [block].
 * block -> undefined is handled.
  */
function log_Map(label, map) {
  if (label === undefined)
    label = '';
  map.forEach(function (value, key) {
    let blocks = value;
    console.log(label, block_text(key), blocks && blocks.map(block_text));
  });
}
/** log a Map string -> Map (string -> [block])
  */
function log_Map_Map(label, map) {
  map.forEach(function (value, key) {
    console.log(label, 'key', key);
    log_Map('', value);
  });
}

/** Filter the values of the given map. If the filter result is undefined, omit
 * the value from the result map.
 * This is a combination of map and filter.
 * @param map a Map
 * @return a Map, or undefined if the result Map would be empty.
 */
function filterMap(map, mapFilterFn) {
  /* factored out of viewedBlocksByReferenceAndScope(); similar to :
   * https://stackoverflow.com/questions/48707227/how-to-filter-a-javascript-map/53065133 */
  let result;
  for (let [key, value] of map) {
    let newValue = mapFilterFn(value);
    if (newValue) {
      if (! result)
        result = new Map();
      result.set(key, newValue);
    }
  }
  return result;
}

/*----------------------------------------------------------------------------*/


/**
  @class services/data/block.js
  @extends Service
  @public

 * Augment the store blocks with features to support mapview.
 * In particular, add an `isViewed` attribute to blocks, which indicates that
 * the block is viewed in the mapview.
 *
 *  It is possible that later there will be multiple mapviews in one route, in
 *  which case the isViewed state might be split out of this singleton service,
 *  or this may become a per-mapview component.
 *
 * @param params  model.params;  the viewed CPs are based on .mapsToView from the URL.
 */
export default Service.extend(Evented, {
  auth: service('auth'),
  // store: service(),
  apiServers: service(),
  pathsPro : service('data/paths-progressive'),
  flowsService: service('data/flows-collate'),
  queryParams: service('query-params'),
  controls : service(),
  axisBrush: service('data/axis-brush'),

  params : alias('queryParams.params'),
  /** params.options is the value passed to &options=
   * parsedOptions is the result of parsing the values from that into attributes.
   * params.parsedOptions is just the parsed values, and queryParams.urlOptions has defaults added.
   */
  parsedOptions : alias('queryParams.urlOptions'),

  store : computed(
    'apiServers.serversLength', // effectively servers.@each.
    'apiServers.primaryServer.store',
    function () {
    let store = this.get('apiServers.primaryServer.store');
    return store;
  }),


  summaryTask : {},

  /** Indicate a Feature update which affects Block properties,
   * e.g. feature-edit saves change to Feature.values.Ontology, so
   * blockFeatureOntologies should be requested, and manage-explorer should
   * update the CPs which depend on that
   * (blockFeatureOntologies{,Blocks,History,Name,Tree,TreeGrouped,TreeEmbedded}
   * ontologiesTree{,KeyLength} ontologyId2{Blocks,DatasetNodes,Node} ).
   */
  featureUpdateCount : 0,

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

  /*--------------------------------------------------------------------------*/


  /** Call getData() in a task - yield the block result.
   * Signal that receipt with receivedBlock(id, block).
   *
   * taskGet()->getData() is only used if allInitially (i.e. not progressive loading);
   * so there is no current need for getBlocks(), taskGet() and getData().
   */
  taskGet: task(function * (id) {
    debugger; // see header comment
    /** if not already loaded and viewed, then trigger receivedBlock */
    let isViewed = this.get('getIsViewed').apply(this, [id]);
    let block = yield this.getData(id);
    // console.log('taskGet', this, id, block);
    if (! isViewed)
    {
      block.set('isViewed', true);
      this.trigger('receivedBlock', [{id, obj : block}]);
    }
    return block;
  }),
  getData: function (id) {
    debugger; // see header comment in taskGet();
    // console.log("block getData", id);
    let server = this.blockServer(id),
    store = server.store,
    apiServers = this.get('apiServers');
    let allInitially = this.get('parsedOptions.allInitially');
    let options = 
      { reload: true};
    if (allInitially)
      options.adapterOptions = 
        {
          filter: {include: "features"}
        };
    if (server) {
      let adapterOptions = options.adapterOptions || (options.adapterOptions = {});
      adapterOptions = apiServers.addId(server, adapterOptions);
    }
    let blockP = store.findRecord(
      'block', id,
      options
    );

    return blockP;
  }  // allow multiple in parallel - assume id-s are different
  // later can use ember-contextual-service to give each id its own task scheduler
  ,

  /*--------------------------------------------------------------------------*/

  /** Call getLimits() in a task - yield the block limits result.
   */
  taskGetLimits: task(function * (blockId) {
    let blockLimits = yield this.getLimits(blockId);
    if (trace_block)
      dLog('taskGetLimits', this, blockId, valueOrLength(blockLimits));
    const apiServers = this.get('apiServers');
    blockLimits.forEach((bfc) => {
      let block = this.peekBlock(bfc._id);
      if (! block) {
        let stores = apiServers.blockId2Stores(bfc._id);
        if (! stores.length) {
          dLog('taskGetLimits', bfc._id);
        }
      }
      else {
        // console.log('taskGetLimits', bfc, block);
        block.set('featureLimits', [bfc.min, bfc.max]);
        if (! block.get('featureValueCount'))
          block.set('featureValueCount', bfc.featureCount);
      }
    });
    
    return blockLimits;
  }).drop(),

  getLimits: function (blockId) {
    // console.log("block getLimits", blockId);
    let blockP =
      this.get('auth').getBlockFeatureLimits(blockId, /*options*/{});

    return blockP;
  },


  /*--------------------------------------------------------------------------*/

  /** Perform taskGetValues once when first requested.
   * @param fieldName 'Trait' or 'Ontology'
   * @return promise yielding :
   * [... ,
   * { "_id" : ObjectId(...), "Traits" : [ "Plant height", "Rust resistance" ] },
   * ...]
   */
  blockFeatureValues(apiServer, fieldName) {
    const
    /** both the result and its promise are stored. */
    name = 'blockFeature' + fieldName,
    pName = name + 'P',
    /** The result is a compilation from the datasets / blocks on a server, so
     * it is an attribute of apiServer.
     * featureSaved() clears .pName, to enable result refresh after feature (.values.Ontology) save.
     */
    promise = apiServer[pName] || 
      (apiServer[pName] = this.get('taskGetValues').perform(apiServer, fieldName)
       .then((values) => (apiServer[name] = values)) );

    return promise;
  },
  /** Call getBlockValues() in a task - yield the block Traits or Ontologys result.
   */
  taskGetValues: task(function * (server, fieldName) {
    const fnName = 'taskGetValues';
    dLog("block", fnName);
    let blockP =
        this.get('auth').getBlockValues(fieldName, /*options*/{server});
    let blockValues = yield blockP;

    if (trace_block)
      dLog(fnName, this, fieldName, valueOrLength(blockValues));
    
    return blockValues;
    /* blockFeatureValues() guards against concurrent tasks for a given
     * apiServer & fieldName, so .drop() is not required. */
  }), // .drop(),

  /*--------------------------------------------------------------------------*/

  apiServerSelectedOrPrimary : alias('controls.apiServerSelectedOrPrimary'),

  ontologyIds : computed(
    'apiServerSelectedOrPrimary.blockFeatureOntologies',
    'apiServers.datasetsBlocksRefresh', // as in blockValues
  function () {
    let
    idsP = this.get('apiServerSelectedOrPrimary.blockFeatureOntologies').then((bos) => {
      let
      idsSet = bos.reduce((result, bo) => {
        bo.Ontologies.forEach((o) => result.add(o));
        return result;
      }, new Set()),
      ids = Array.from(idsSet.keys());
      dLog('ontologyIds', bos, idsSet, ids);
      return ids;
    });
    return idsP;
  }),

  ontologyRoots : computed('ontologyIds', function () {
    let
    rootsP = this.get('ontologyIds').then((ois) => {
      let
      rootsSet = ois.reduce((result, ontologyId) => {
        /** skip ontologyId if it is a number.
         * ontologyId is expected to be a string.
         */
        let
        rootIdMatch = ontologyId?.match && ontologyId.match(/^(CO_[0-9]+):/),
        rootId = rootIdMatch && rootIdMatch[1];
        if (rootId) {
          result.add(rootId);
        }
        return result;
      }, new Set()),
      roots = Array.from(rootsSet.keys());
      dLog('ontologyRoots', ois, rootsSet, roots);
      return roots;
    });
    return rootsP;
  }),




  /*--------------------------------------------------------------------------*/

  featureSaved() {
    /* The API result blocksService.blockFeatureOntologies is invalidated by
     * this save, so clear the result promise to trigger a new request.
     * The dependency on apiServerSelectedOrPrimary.blockFeatureOntologies in
     * manage-explorer.js doesn't seem to detect that change, so the signal
     * featureUpdateCount is added.
     */
    let fieldName = 'Ontology',
        name = 'blockFeature' + fieldName,
        pName = name + 'P';
    /** this could be an action forwarded to api-server */
    let server = this.get('apiServerSelectedOrPrimary');
    dLog('featureSaved', pName, server.get(name), this.apiServers.datasetsBlocksRefresh);
    server.set(pName, null);
    server.set(name, null);
    this.incrementProperty('featureUpdateCount');
  },

  /*--------------------------------------------------------------------------*/


  /** Call getSummary() in a task - yield the block result.
   * Signal that receipt with receivedBlock([{id, obj:block}]).
   */
  taskGetSummary: task(function * (blockIds) {
    let blockFeatureCounts = yield this.getSummary(blockIds);
    console.log('taskGetSummary', this, blockIds, blockFeatureCounts);
    blockFeatureCounts.forEach((bfc) => {
      let block = this.peekBlock(bfc._id);
      if (! block)
        console.log('taskGetSummary', bfc._id);
      else
        block.set('featureCount', bfc.featureCount);
    });
    let blocksToView = this.blockIdsReferences(blockIds, false);
    this.viewReferences(blocksToView);
    let dataAndReferences = blocksToView.concat(
      blockIds.map((blockId) => { return {id : blockId, obj : this.peekBlock(blockId)}; }))
      // filter out .obj === null, i.e. block not in store yet.
        .filter((blockIdObj) => blockIdObj.obj);
      console.log('taskGetSummary dataAndReferences', dataAndReferences);
    this.receivedBlocks(dataAndReferences);
    
    return blockFeatureCounts;
  }),
  /** Take blockIds as parameter instead of blocks, but otherwise the same as @see blocksReferences,
   * @description which this is a wrapper around.
 */
  blockIdsReferences(blockIds, selfReferences) {
    let blocks = blockIds.map((blockId) => {
      let block = this.peekBlock(blockId);
      if (! block)
        console.log('blockIdsReferences', blockId);
      return block;
    })
      .filter((block) => block),
    referenceBlocks = this.blocksReferences(blocks, selfReferences);
      return referenceBlocks;
  },
  /** @return the reference blocks corresponding to the given blocks.
   * Result form is an array of {id : blockId, obj : block}.
   * Each id occurs just once in the result.
   * @param blocks  Block records in Ember store
   * @param selfReferences  if false then
   * a block which is its own reference (GM) it is not included in the result.
   * @description later : suppress duplicates.
   */
  blocksReferences(blocks, selfReferences) {
    /* blockFeatureCounts will omit reference blocks since they have no features,
     * so use blockIds to set viewed and trigger receivedBlock.
     */
    /** Using an array for output enables CPs to depend on sub-fields of the array.
     * If selfReferences then need to avoid getting duplicates, so this hash
     * keeps track of which blockIds have been added to blocksToView.
     * (The array also maintains the original order, which may have some use).
     * May split this out as a separate function, with one depending on the other;
     * could be done in either order.
     */
    let blockIds = {};
    let blocksToView =
      blocks.reduce((result, block) => {
        function addIdObj(id, obj) {
          if (! blockIds[id]) {
            blockIds[id] = obj;
            result.push({id, obj});
          }
        }
        /** .referenceBlock is undefined for GMs, as they have no parent.
         */
        let referenceBlock = block.get('referenceBlock');
        if (referenceBlock) {
          /* check is not needed as currently blocks which are their own
           * reference (genetic maps) have .referenceBlock === undefined.
           */
          if (selfReferences || (referenceBlock !== block))
            addIdObj(block.id, referenceBlock);
        }
        else if (selfReferences)
          addIdObj(block.id, block);
        return result;
      }, []);
    return blocksToView;
  },
  /** For trace in Web Inspector console.
   * Usage e.g. this.get('blocksReferences').map(this.blocksReferencesText);
   * @param io {id : blockId, obj : blockObject }
   */
  blocksReferencesText(io) {
    let b=io.obj; return [io.id, b.view && b.view.longName(), b.mapName]; },

  /** Collate the ranges or feature limits of the references of the given blockIds.
   * This is used for constructing boundaries in
   * backend/common/utilities/block-features.js : blockFeaturesCounts().
   * @return a hash object mapping from blockId to reference limits [from, to].
   */
  blocksReferencesLimits(blockIds) {
    /** blocksReferencesLimit() is used as the basis of
     * models/block.js: referenceLimits(), and that can be used here, e.g.
     * blockIds.map((blockId) => this.peekBlock(blockId).get('referenceLimits') )
     */
    function blocksReferencesLimit(io) {
      let b=io.obj; return b.get('range') || b.get('featureLimits'); };
    let
      blocksReferences = this.blockIdsReferences(blockIds, true),
    result = blocksReferences.reduce(function (result, io) {
      if (! result[io.id]) {
        result[io.id] = blocksReferencesLimit(io);
      }
      return result;
    }, {});

    if (trace_block > 1)
      dLog('blocksReferencesLimits', blockIds, result,
           blocksReferences.map(this.blocksReferencesText) );
    return result;
  },


  /** Set .isViewed for each of the blocksToView[].obj
   * @param blocksToView form is the result of this.blocksReferences()
   */
  viewReferences(blocksToView) {
    Ember.changeProperties(function() {
      blocksToView.forEach(function(b) {
        b.obj.set('isViewed', true);
        console.log('taskGetSummary changeProperties isViewed', b.obj.get('id'));
      });
    });
  },
  receivedBlocks(blocksToView) {
    /** trigger receivedBlock() for the requested blocks and their parents.
     *
     * Event triggers are immediate, growing the stack and possibly creating
     * recursion, whereas ComputedProperty-s are evaluated in a batch within
     * the run-loop cycle.  So this event trigger is likely to be transitioned
     * to a ComputedProperty dependency.
     * This concern is ameliorated by using a single trigger for all of the
     * blocksIds, omitting those already viewed, and including their referenceBlock-s.
     */
    this.trigger('receivedBlock', blocksToView);
  },

  controlsView : alias('controls.view'),
  featuresCountsNBins : alias('controlsView.featuresCountsNBins'),
  /** This does have a dependency on the parameter values.  */
  pathsDensityParams : alias('controlsView.pathsDensityParams'),
  /** Calculate nBins for featuresCounts request based on pathsDensityParams.
   * A separate slider is now added for featuresCountsNBins, so this is not
   * currently used, and may be dropped; it is possible that density calculation
   * may be useful in selecting nBins in some cases.
   * @param blockId later will use this to lookup axis yRange
   */
  nBinsFromPathParams(blockId) {
    let nBins;
    /** based on part of intervalParams(intervals) */
    let vcParams = this.get('pathsDensityParams');
    if (vcParams.nSamples) {
      nBins = vcParams.nSamples;
    }
    if (vcParams.densityFactor) {
      /** from paths-aggr.js : blockFeaturesInterval()
       */
      let pixelspacing = 5;
      let range = 600;  // -	lookup axis yRange from block;
      let nBins = vcParams.densityFactor * range / pixelspacing;
    }
    if (vcParams.nFeatures) {
      if (nBins > vcParams.nFeatures)
         nBins = vcParams.nFeatures;
    }
    dLog('nBins', nBins, vcParams);
    return nBins;
  },

  getSummary: function (blockIds) {
    const fnName = 'getSummary';
    // console.log("block getSummary", id);
    let
    /** true enables $bucketAuto as an alternative to $bucket using
     * boundaries calculated from nBins and interval.  This option
     * will enable comparison of performance in operation.
     */
    useBucketAuto = this.get('parsedOptions.useBucketAuto'),

    /** check if feature count of block is already received.  */
    blocksWithoutCount = blockIds.filter((blockId) => {
      let block = this.peekBlock(blockId);
      return ! block || ! block.get('featureCount');
    }),
    blockP = blocksWithoutCount.length ?
      this.get('auth').getBlockFeaturesCount(blocksWithoutCount, /*options*/{}) :
      resolve([]);

    /** Request features counts for data blocks (not reference blocks).  */
    if (this.get('parsedOptions.featuresCounts')) {

    /** As yet these result promises are not returned, not needed. */
    let blockPs =
        blockIds.map((blockId) => [blockId, this.peekBlock(blockId)])
        /** URL mapsToView may contain blockId of another server which is not
         * currently connected, and hence blockAndId[1] is undefined. */
        .filter((blockAndId) => blockAndId[1] && blockAndId[1].get('isData')
                && ! blockAndId[1].hasTag('Germinate'))
        .map(
          (blockAndId) => {
          let [blockId, block] = blockAndId;
          /** densityFactor requires axis yRange, so for that case this will (in future) lookup axis from blockId. */
          const nBins = this.get('featuresCountsNBins'); // this.nBinsFromPathParams(blockId);
          let
            zoomedDomain = block && block.get('axis1d.zoomed') && block.get('zoomedDomain'),
            zoomedDomainText;
          if (zoomedDomain) {
            let
            domainSize = intervalSize(zoomedDomain),
            relativeDomain = zoomedDomain.map((y) => y / domainSize);
          /** granularise zoomedDomain to so that request is sent after e.g. 5% zoom change.
           * Perhaps 
           */
          zoomedDomainText =
            '_' + truncateMantissa(relativeDomain[0]) +
            '_' + truncateMantissa(relativeDomain[1]);
          }
            const filtersText = Object.entries(this.controls.genotypeSNPFilters).map(kv => kv.join('_')).join('_');
            let taskId = blockId + '_' + nBins + (zoomedDomainText || '') + filtersText;
          let summaryTask = this.get('summaryTask');
          let p;
            if ((p = summaryTask[blockId]) && (! p.state || p.state() === "pending")) {
              // state() : pending   ~   readyState : 1
              dLog('getSummary current', blockId, p, p.readyState);
            } else if ((p = summaryTask[taskId])) {
              // .state() : resolved   ~   .readyState : 4   ~  .statusText : OK
              dLog('getSummary re-use', taskId, p, p.state(), p.readyState, p.statusText);
            } else {
            if (zoomedDomain) {
              dLog('getSummary', zoomedDomainText, zoomedDomain);
            }
            getCounts.apply(this);
            function getCounts() {
              let interval = zoomedDomain;
              let intervalFromLimits = (blockId) => {
                let intervals = this.blocksReferencesLimits([blockId]);
                return intervals[blockId];
              };
              if (! zoomedDomain) {
                interval = intervalFromLimits(blockId);
              }
              /** User controls which filter genotype SNPs.
               */
              let userOptions;
              let getCountsForInterval = (interval) => {
                let countsP;
                if (interval && (interval[0] === interval[1])) {
                  dLog('getCountsForInterval', interval);
                  countsP = Promise.resolve([]);
                } else {
                  /** userOptions is optional, and the fields are optional. */
                  if (block.isVCF) {
                    userOptions = this.controls.genotypeSNPFilters;
                  }
                  countsP =
                  this.get('auth').getBlockFeaturesCounts(blockId, interval, nBins, !!zoomedDomain, useBucketAuto, userOptions, /*options*/{});
                }
                return countsP;
              };
              if (interval) {
              p = summaryTask[taskId] =
                  getCountsForInterval(interval);
              } else {
                /** interval is drawn from the result of blockFeatureLimits
                 * (sent by getBlocksLimits() -> taskGetLimits() ->
                 * getLimits()). It can happen (seen with GM from secondary
                 * server) that the limits have not been received at this time,
                 * so wait for them.
                 * getBlockFeaturesCounts() with interval === undefined will use
                 * bucketAuto, which doesn't produce even-size bins.
                 */
                p = summaryTask[taskId] =
                  new Promise((resolve) => { later(() => {
                    interval = intervalFromLimits(blockId);
                    resolve(interval); }, 4000); })
                  .then(getCountsForInterval);
              }
              summaryTask[blockId] = p;
            /* this could be structured as a task within models/block.js
             * A task would have .drop() to avoid concurrent request, but
             * actually want to bar any subsequent request for the same taskId,
             * which is provided by summaryTask[taskId] above.
             */
            p.then((featuresCounts) => {
              if (! block)
                console.log('getSummary featuresCounts', featuresCounts, blockId);
              else {
                let i = featuresCounts.findIndex((fc) => fc._id === 'outsideBoundaries');
                if (i !== -1) {
                  dLog('getSummary', featuresCounts[i]);
                  delete featuresCounts[i];
                }
                /** featuresCounts[0] may be undefined because of delete
                 * featuresCounts[i] ~ outsideBoundaries
                 */
                let
                f0 = featuresCounts && featuresCounts.length && featuresCounts[0],
                binSize = f0 ?
                  (f0.idWidth ? f0.idWidth[0] : ((f0.max - f0.min) || 1)) :
                  (interval ? (0, intervalSize)(interval) / nBins : 1),
                result = {userOptions, binSize, nBins, domain : interval, result : featuresCounts};
                block.featuresCountsResultsMergeOrAppend(result);
                // after MergeOrAppend, .featuresCountsResultsFiltered seems preferable to featuresCounts
                block.set('featuresCounts', featuresCounts);
                // could also check block.limits matches featuresCountsDomain(featuresCounts)
                const featureCount = featuresCountsResultSum(featuresCounts);
                if (! block.featureCount || (block.featureCount < featureCount)) {
                  dLog(fnName, block.featureCount, 'featureCount', featureCount);
                  block.set('featureCount', featureCount);
                }
              }
            });
            }
          }
          return p;
        });
    }

    return blockP;
  },

  /**
   * @param server	apiServer
   */
  getBlocksFeaturesCountsStatus: function (blockIds, server) {
    const
    fnName = 'getBlocksFeaturesCountsStatus',
    nBins = this.get('featuresCountsNBins'),
    useBucketAuto = this.get('parsedOptions.useBucketAuto'),
    /** if blockIds is undefined, then options.server is required */
    options = {server},
    statusP =
      this.get('auth').getBlocksFeaturesCountsStatus(blockIds, nBins, useBucketAuto, options);

    return statusP;
  },

  /*--------------------------------------------------------------------------*/

  /** @return the block record handle if the block is loaded into the store from the backend.
   * @desc same as controllers/mapview @see blockFromId()
   */
  peekBlock(blockId)
  {
    const fnName = 'peekBlock';
    if ((blockId === undefined) || (blockId === null)) {
      return undefined;
    }
    if (typeof blockId != 'string') {
      dLog(fnName, 'blockId', blockId);
      return undefined;
    }
    let
      apiServers = this.get('apiServers'),
    store = apiServers.id2Store(blockId),
    block;
    /** transient blocks are not present in id2Server[] (services/api-servers),
     * so fall back to searching each server store. */
    if (store) {
      block = store && store.peekRecord('block', blockId);
    } else {
      block = findResult(Object.values(apiServers.servers),
        apiServer => apiServer.store.peekRecord('block', blockId));
    }
    return block;
  },

  /*--------------------------------------------------------------------------*/

  /** As for blockServer(), but lookup via block.
   * Similar to @see id2Store().
   */
  blockServerById(blockId)
  {
    let 
      id2Server = this.get('apiServers.id2Server'),
    server = id2Server[blockId];
    return server;
  },

  /** Get the API host from which the block was received, from its dataset meta,
   * and lookup the server from the host.
   * @return server ApiServer, or undefined.
   */
  blockServer(blockId)
  {
    let
    block = this.peekBlock(blockId),
    datasetId = block && block.get('datasetId'), 
    dataset = datasetId && datasetId.get('content'),
    host = dataset && dataset.get('_meta.apiHost'),
    apiServers = this.get('apiServers'),
    server = apiServers.lookupServer(host);
    console.log('blockServer', block, dataset, host, server);
    return server;
  },

  /** @return true if the 2 blocks are received from the same API host server. */
  blocksSameServer(blockA, blockB)
  {
    /* the object ID of 2 objects from the same mongodb will have a number of leading digits in common.  */
    let a = this.blockServer(blockA),
    b = this.blockServer(blockB);
    return a === b;
  },

  /*--------------------------------------------------------------------------*/

  /** @return true if the blockId is in the URL mapsToView
   */
  getIsViewed(blockId)
  {
    let
      viewedIds = this.get('params.mapsToView'),
    index = viewedIds.indexOf(blockId),
    isViewed = (index >= 0);
    return isViewed;
  },
  /** Set the viewed state of the given blockId.
   * @param blockId may be an array of blockIds, in which case the function is called for each element blockId
   */
  setViewed(blockId, viewed) {
    if (isArray(blockId))
    {
      blockId.forEach((blockId) => this.setViewed(blockId, viewed));
    }
    else {
      if (typeof blockId !== "string")
        blockId = blockId.get('id');
      let viewedIds = this.get('params.mapsToView'),
      index = viewedIds.indexOf(blockId);
      dLog('setViewed', blockId, viewed, viewedIds, index, this);
      if (viewed === (index >= 0)) {
        // no change
      }
      else if (viewed) {
        viewedIds.pushObject(blockId);
      }
      else {
        // later() so that mapsToView is modified after current render cycle.
        later(() => {
          const
          index = viewedIds.indexOf(blockId),
          removed = viewedIds.objectAt(index);
          // viewedIds may be already updated
          if (index !== -1) {
            viewedIds.removeAt(index, 1);
            dLog('setViewed removing', removed);
          }
        });
      }
    }
  },


  /*--------------------------------------------------------------------------*/

  /**
   * The GUI does not provide a way for the user to unview a block which is not currently loaded.
   *
   * Previously used by (replaced by services/ block.setViewed())
   * mixins/viewed-blocks.js : @see setViewed(),
   * @description which also defines an alternative implementation (unused) : @see setViewed0()
   *
   * @description
   * If viewed && unviewChildren && this block doesn't have .namespace then
   * search the loaded blocks for blocks which reference the block being
   * unviewed, and mark them as unviewed also.
   * @param unviewChildren
   *
   * @return define a task
   */
  setViewedTask: task(function * (id, viewed, unviewChildren) {
    debugger; // only used in viewed-blocks
    console.log("setViewedTask", id, viewed, unviewChildren);
    let getData = this.get('getData');
    /* -  if ! viewed then no need to getData(), just Peek and if not loaded then return.
     * The GUI only enables viewed==false when block is loaded, so that difference is moot.
     */
    let block = yield getData.apply(this, [id]);
    console.log('setViewedTask', this, id, block);
    this.beginPropertyChanges();
    if (block.get('isViewed') && ! viewed && unviewChildren)
    {
      /** see also loadedViewedChildBlocks, but that depends on hasFeatures
       * which depends on receiving response for feature count/s or features. */
      let toUnview = block.get('childBlocks');
      console.log('setViewedTask', toUnview
                  .map(block_text) );
      toUnview.forEach(function (childBlock) {
        childBlock.set('isViewed', viewed);
      });
    }
    block.set('isViewed', viewed);

    this.endPropertyChanges();

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
      (d !== d2) &&  // not self
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

  /** Only used if allInitially (i.e. not progressive loading)
   * @see taskGet()
   */
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

    /** get featureLimits if not already received.  After upload the block won't have
     * .featureLimits until requested
     * @param blockId if undefined then check all blocks
     */
  ensureFeatureLimits(blockId) {
    let store = this.get('apiServers').id2Store(blockId);
    if (true) {
      /** If blockId is undefined then request limits for all blocks. */
      let blocksLimitsTasks = this.getBlocksLimits(blockId);
    }
    else {
      /** When called from data-csv refreshDatasets(), blockId is undefined
       * (dataset name is known); in that case the above simply gets limits for
       * all blocks, whereas the following skips the request for blocks which
       * already have .featureLimits or are reference blocks.  It generates a
       * burst of requests which is not compatible with the .drop() on taskGetLimits().
       */
      let
        blocks = blockId ?
        [ store.peekRecord('block', blockId) ]
        : store.peekAll('block');
      blocks.forEach((block) => {
        block.ensureFeatureLimits();
      });
    }
  },

  /**
   * @param blockId optional : get limits for just 1 block; normally this is
   * undefined and limits are requested for all blocks.
   */
  getBlocksLimits(blockId) {
    /** don't call taskGetLimits for a transient block. */
    if (blockId && this.peekBlock(blockId)?.hasTag('transient')) {
      // Limits of the parent / reference are applicable.
      /** taskGetLimits() sets .featureLimits and .featureValueCount; perhaps
       * calculate those here.
       */
      return Promise.resolve([]);
    }

    const fnName = 'getBlocksLimits';
    let taskGet = this.get('taskGetLimits');
    console.log("getBlocksLimits", blockId);
      let p =  new Promise((resolve, reject) => {
        later(() => {
          let
          blocksTask = taskGet.perform(blockId)
            .then((result) => resolve(result))
            .catch((error) => {
              // Recognise if the given task error is a TaskCancelation.
              if (! didCancel(error)) {
                dLog(fnName, ' taskInstance.catch', this.name, error);
                // throw error;
                reject(error);
              }
            });
        });
      });
    let blocksTask = p;
    console.log("getBlocksLimits() result blocksTask", blocksTask);
    return blocksTask;
  },


  getBlocksSummary(blockIds) {
    /** Filter out the transient blocks; set their .featureCount, and don't call
     * taskGetSummary for them. */
    const
    blocks = blockIds.map(blockId => this.peekBlock(blockId)),
    /** result of hasTag() is true or falsey (undefined / 0 / false) */
    transientBlocks = Object.groupBy(blocks, block => !!block?.hasTag('transient'));
    transientBlocks['true']?.forEach(block => block.set('featureCount', block.features.length));
    blockIds = transientBlocks['false']?.map(block => block.id) ?? [];

    let taskGet = this.get('taskGetSummary');
    console.log("getBlocksSummary", blockIds);
      let p =  new Promise(function(resolve, reject){
        later(() => {
          let blocksTask = taskGet.perform(blockIds);
          blocksTask.then((result) => resolve(result));
          blocksTask.catch((error) => reject(error));
        });
      });
    let blocksTask = p;
    console.log("getBlocksSummary() result blocksTask", blocksTask);
    return blocksTask;
  },


  /*--------------------------------------------------------------------------*/


  /** @return promise of block records */
  blockValues: computed(
    'apiServers.serversLength',  // effectively servers.@each.
    'apiServers.servers.@each.datasetsBlocks',
    // effectively servers.@each.datasetsBlocks, which can't work because servers is a hash not an array.
    'apiServers.datasetsBlocksRefresh',
    function() {
      let
        stores = this.get('apiServers.stores'),
      records;

      if (stores.length === 1)
        records = stores[0].peekAll('block');
      else {
        let
          arrays = stores.map((s) => s.peekAll('block').toArray());
        records = arrays
          .reduce((acc, a) => acc.concat(a), []);
        dLog('blockValues', stores, arrays, records);
      }

      if (trace_block > 3)
        console.log('blockValues', records);
      return records;
    }),
  /** Can be used in place of peekBlock().
   * Copies are filtered out.
   * @return array which maps from blockId to block   
   */
  blocksById: computed(
    'blockValues.[]',
    function() {
      let blocksById = this.get('blockValues').reduce((r, b) => {
        /** Copies are not viewed, the originals are.
         * Also copies have the same id, so an array would be needed to store them here. */
        if (! b.get('isCopy'))
          r[b.get('id')] = b; return r;
        }, {});
      return blocksById;
    }),
  id2Block(blockId) {
    let
    blocksById = this.get('blocksById'),
    block = blocksById[blockId];
    return block;
  },
  selected: computed(
    'blockValues.@each.isSelected',
    function() {
      let records = this.get('blockValues')
        .filterBy('isSelected', true);
      if (trace_block)
        console.log('selected', records);
      return records;  // .toArray()
    }),
  viewed : computed(
    'blocksById', 'params.mapsToView.[]',
    'blockValues.[]',
    function () {
    let blocksById = this.get('blocksById'),
    viewedIds = this.get('params.mapsToView'),
    /** mapsToView[] is defined from URL, but blocksById[] is defined later from
     * API response.  So filter out blocks which are not yet loaded.
     */
    viewed = viewedIds.map((blockId) => blocksById[blockId])
      .filter((block) => block);
    return viewed;
  }),
  viewedById : computed('viewed.[]', function () {
    let viewed = this.get('viewed'),
    viewedById = keyBy(viewed, (b) => b.id);
    return viewedById;
  }),
  // viewedVisible : filterBy('viewed', 'visible'),
  viewedVisible : computed('viewed.@each.visible', function () {
    const visible = this.viewed.filterBy('visible');
    dLog('viewedVisible', visible.mapBy('id'));
    return visible;
  }),
  /** Ensure that there is an axis for each viewed block.
   */
  viewedAxisEffect : computed('viewed.[]', function () {
    let viewed = this.get('viewed'),
    axes = viewed.map((block) => this.blockAxis(block));
      console.log('viewed axes', axes);
    return axes;
  }),

  viewedIds: computed(
    'params.mapsToView.[]',
    'blocksById.[]',
    function() {
      let
        ids = this.get('params.mapsToView'),
      blocksById = this.get('blocksById');
      if (trace_block > 1)
        ids.map(function (id) { console.log('viewedIds', id, blocksById[id]); } );
      return ids;
    }),
  viewedScopes: computed(
    'viewed.[]',
    function() {
      let records = this.get('viewed');
      if (trace_block > 1)
        records.map(function (a) { console.log('viewedScopes', a, a.get('scope')); } );
      if (trace_block)
        console.log('viewedScopes', records);
      let scopes = records.reduce(function (result, a) { let scope = a.get('scope'); return result.add(scope); }, new Set() );
      scopes = Array.from(scopes);
      if (trace_block)
        console.log('viewedScopes', scopes);

      return scopes;
    }),

  /** Return (a promise of) the viewed blocks which contain a numeric value for
   * each feature, in addition to the feature position.
   * These are suited to be rendered by axis-chart.
   */
  viewedChartable: computed(
    'viewed.@each.{featuresCounts,isChartable,isZoomedOut}',
    function() {
      const fnName = 'viewedChartable';
      let records =
        this.get('viewed')
        .filter(function (block) {
          let tags = block.get('datasetId.tags'),
          featuresCounts = block.get('featuresCounts') && block.get('isZoomedOut'),
          line = block.get('isChartable');
          if (line)
            console.log('viewedChartable', tags, block);
          return featuresCounts || line;
        });
      if (trace_block > 1) {
        console.log(
          're. featuresCounts',
          'viewedChartable', records
            .map(function(blockR) { return blockR.view.longName(); })
        );
      }
      return records;  // .toArray()
    }),

  /** @return blocks which are viewed and are configured for display
   * of paths, i.e.  are data blocks not reference, have
   * datasetId._meta.paths === true, and datasetId.tags[] does not
   * contain 'SNP' - implemented in showPaths.
   * @desc
   * Used by flows-collate : blockAdjIds(), which determines the
   * blocks for which paths requests are sent.
   */
  viewedForPaths: computed(
    'viewed.@each.{isData,showPaths}',
    function() {
      let blocks = this.get('viewed'),
          filtered = blocks.filter((block) => block.get('isData') && block.get('showPaths'));
      dLog('viewedForPaths', blocks.length, filtered);
      return filtered;
    }),

  //----------------------------------------------------------------------------

  /** Return viewed (loaded) VCF blocks
   *
   * This is based on and related to the (synonymous) viewedVCFBlocks() in
   * components/panel/manage-genotype.js, except that function returns
   * [{axisBrush, vcfBlock}, ...] instead of [block, ...]
   *
   * @return [block, ...]
   */
  viewedVCFBlocks : computed('viewed.[]', function() {
    const
    fnName = 'viewedVCFBlocks',
    vcfBlocks = this.viewed.filter(
      (b) => b.get('isVCF'));
    dLog(fnName, vcfBlocks, this.viewed.length, this.params.mapsToView);
    return vcfBlocks;
  }),

  /** Estimates of the count of brushed SNPs of viewed VCFs, using block.featuresCountIncludingBrush
   */
  brushedVCFFeaturesCounts : computed('viewedVCFBlocks', 'axisBrush.brushCount', function() {
    const
    fnName = 'brushedVCFFeaturesCounts',
    vcfBlocks = this.viewedVCFBlocks.mapBy('featuresCountIncludingBrush');
    return vcfBlocks;
  }),

  /*----------------------------------------------------------------------------*/

  /** collate the blocks by the parent they refer to.
   * Based on Block.referenceBlock(), so the result does not include blocks
   * which do not have a reference and are not referenced.
   */
  blocksByReference: computed(
    'blockValues.@each.referenceBlock',
    function() {
      let map = this.get('blockValues')
        .reduce(
          (map, block) => {
            let id = block.id,
            referenceBlock = block.get('referenceBlock');
            if (referenceBlock) {
              let blocks = map.get(referenceBlock);
              if (! blocks)
                map.set(referenceBlock, blocks = []);
              blocks.push(block);
            }
            return map; },
          new Map());

      if (trace_block > 1)
        log_Map('blocksByReference', map);
      return map;
    }),

  /** collate the blocks by the parent block they refer to, and by scope.
   *
   * @return a Map, indexed by dataset name, each value being a further map
   * indexed by block scope, and the value of that being an array of blocks,
   * with the [0] position of the array reserved for the reference block.
   *
   * @desc
   * Blocks without a parent / reference, will be mapped via their datasetId,
   * and will be placed in [0] of the blocks array for their scope.
   * For Blocks with datasetId.parentName, but no matching parent on the
   * currently connected servers, blocks[0] will be undefined.
   */
  blocksByReferenceAndScope : computed(
    'blockValues.[]',
    function() {
      return this.mapBlocksByReferenceAndScope(this.get('blockValues'));
    }),

  /** For each datasetId:scope:, an array of blocks is recorded.
   * Lookup the blocks array, and create it if it does not yet exist.
   * blocks[0] is reserved for the reference block, so a new array is
   * [undefined], and blocks[0] is set by the caller.
   *
   * @param map contains the datasetId:scope:blocks hierarchy.
   * @param create added to indicate whether to create a map entry if it doesn't exist.
   * The 2nd pass of mapBlocksByReferenceAndScope() passes create===false - see
   * comment there.
   */
  blocksOfDatasetAndScope(map, create, datasetId, scope) {
    /** Lookup the map for datasetId; create it if it does not yet exist. */
    let mapByScope = map.get(datasetId);
    if (! mapByScope && create) {
      mapByScope = new Map();
      map.set(datasetId, mapByScope);
    }
    /** Lookup the blocks[] for scope; create it if it does not yet exist. */
    let blocks = mapByScope?.get(scope);
    if (! blocks && create)
      mapByScope.set(scope, blocks = [undefined]); // [0] is reference block
    return blocks;
  },

  mapBlocksByReferenceAndScope(blockValues) {
      const fnName = 'blocksByReferenceAndScope';

      let map = blockValues
        .reduce(
          (map, block) => {
            // related : manage-explorer : datasetsToBlocksByScope() but that applies a filter.
            let id = block.id,
            scope = block.get('scope'),
            /** If block is a promise, block.get('datasetId.parent') will be a
             * promise - non-null regardless of whether the dataset has a
             * .parent, whereas .get of .parent.name will return undefined iff
             * there is no parent.  Now that .parent is changed from a relation
             * managed by ember-data to a CP, this logic has changed :
             * Now with the addition of cross-server references, .parentName may
             * be defined but not .parent, e.g. there is no matching parent on
             * the currently connected servers.  For the uses of this CP, it is
             * useful to group by .parentName regardless of whether .parent is
             * defined.
             */
            parentName = block.get('datasetId.parent.parentName') || 
                block.get('datasetId.parentName');

            let me = this;
            function blocksOfDatasetAndScope(datasetId, scope) {
              return me.blocksOfDatasetAndScope(map, true, datasetId, scope);
            }
            if (parentName) {
              /** if block.datasetId.parentName, this is a child/data block so add
               * it to the blocks of the reference.
               */
              let blocks = blocksOfDatasetAndScope(parentName, scope);
              blocks.push(block);
            } else {
              /** block is a reference or GM.  Note it in blocks[0] for the datasetName:scope.
               * If that blocks[0] is already set, create a unique scope with a new blocks[].
               */
              let datasetName = block.get('datasetId.name');
              let blocks = blocksOfDatasetAndScope(datasetName, scope);
              if (false && blocks[0]) {
                // console.log(fnName, '() >1 reference blocks for scope', scope, blocks, block, map);
                /* Reference chromosome assemblies, i.e. physical maps, define a
                 * unique (reference) block for each scope, whereas Genetic Maps
                 * are their own reference, and each block in a GM is both a
                 * data block and a reference block, and a GM may define
                 * multiple blocks with the same scope.
                 * As a provisional measure, if there is a name clash (multiple
                 * blocks with no parent and the same scope), append the
                 * datasetName name to the scope to make it unique.
                 */
                blocks = blocksOfDatasetAndScope(datasetName, scope + '_' + datasetName);
              }
              if (blocks[0])
                blocks.push(block);
              else
                blocks[0] = block;
            }
            return map;
          },
          new Map());


    /** Update : previously parent / child was single-level; now can have e.g. a
     * QTL block whose dataset parent is a marker set whose dataset parent is a
     * reference assembly.
     * So now pass through blockValues again, checking if blocks with
     * .datasetId.parentName are also the reference of some other blocks.
     */
      map = blockValues
        .reduce(
          (map, block) => {
            let id = block.id,
            scope = block.get('scope'),
            parentName = block.get('datasetId.parentName');

              let datasetName = block.get('datasetId.name');
              /** Don't create a map entry; this pass is simply to update
               * blocks[0] === undefined in existing map entries.  */
              let blocks = this.blocksOfDatasetAndScope(map, false, datasetName, scope);
              if (blocks && (blocks.length > 1) && ! blocks[0]) {
                blocks[0] = block;
            }
            return map;
          },
          map);

      if (trace_block > 1)
        log_Map_Map(fnName, map);
      return map;
  },

  /** filter blocksByReferenceAndScope() for viewed blocks,
   * blocks[0] is not filtered out even if it isn't viewed because it is the referenceBlock
   *  (this is used in stacks-view.js : axesBlocks()).
   * @return Map, which may be empty
   *
   * Because the result is a Map, which can't be used as an ComputedProperty
   * dependency, increment .viewedBlocksByReferenceAndScopeUpdateCount, so it
   * may be used as an equivalent dependency.
   */
  viewedBlocksByReferenceAndScope : computed(
    /* blocksByReferenceAndScope is a Map, and there is not currently a way to
     * depend on Map.@each, so depend on blockValues.[] which
     * blocksByReferenceAndScope depends on, and viewed.[].
     */
    'blocksByReferenceAndScope', 'blockValues.[]',
    'viewed.[]', function () {
    const fnName = 'viewedBlocksByReferenceAndScope';
    let viewed = this.get('viewed');
    /** map is a 2-level nested Map.
     * It is filtered by referencesMapFilter at the 1st level, and scopesMapFilter at the 2nd level. */
    let map = this.get('blocksByReferenceAndScope'),
     resultMap = filterMap(map, referencesMapFilter);
    /** used when filtering the 1st level map; apply the 2nd level filter scopesMapFilter(). */
    function referencesMapFilter(mapByScope) {
      let resultMap = filterMap(mapByScope, scopesMapFilter);
      if (trace_block > 2)
        dLog('referencesMapFilter', mapByScope, resultMap);
      return resultMap;
    };
    /** used when filtering the 2nd level map;
     * filter the blocks[] which is the map value; filter out blocks which are
     * not viewed, with the exception that blocks[0], the reference block, is
     * retained if any of the other blocks are.
     */
    function scopesMapFilter(blocks) {
      // axis : blocks : [0] is included if any blocks[*] are viewed, ...
      //  && .isLoaded ?
      let blocksOut = blocks.filter((b, i) => ((i===0) || b.get('isViewed')));
      // expect that blocksOut.length != 0 here.
      /* If a data block's dataset's parent does not have a reference block for
       * the corresponding scope, then blocks[0] will be undefined, which is
       * filtered out here.
       * Some options for conveying the error to the user : perhaps display in
       * the dataset explorer with an error status for the data block, e.g. the
       * add button for the data block could be insensitive.
       */
      if ((blocksOut.length === 1) && (! blocks[0] || ! blocks[0].get('isViewed')))
        blocksOut = undefined;
      if (trace_block > 3)
        dLog('scopesMapFilter', blocks, blocksOut);
      return blocksOut;
    };

    if (trace_block > 1 && resultMap)
      log_Map_Map(fnName, resultMap);
    this.incrementProperty('viewedBlocksByReferenceAndScopeUpdateCount');
    return resultMap;
  }),
  viewedBlocksByReferenceAndScopeUpdateCount: 0,


  /** Search for the named features, and return also their blocks and datasets.
   * If blockId is given, restrict the search to that block.
   * @param blockId undefined or DB ObjectId string.
   * @param matchAliases  if true, use featureAliasSearch(), otherwise featureSearch()
   * @param matchRegExp	if true, match featureNames as partial / regexp.
   * @param featureNames  array of Feature name strings
   * @return  features (store object references)
   * If matchAliases, result is {features, aliases}
   */
  getBlocksOfFeatures : task(function* (apiServer, matchAliases, matchRegExp, blockId, featureNames) {
    let
    auth = this.get('auth'),
    featureResults =
      matchAliases ?
      yield auth.featureAliasSearch(apiServer, featureNames, /*options*/{}) :
      yield auth.featureSearch(apiServer, blockId, featureNames, matchRegExp, /*options*/{});
    let features = this.pushFeatureSearchResults(apiServer, featureResults.features);
    let result = matchAliases ? Object.assign(featureResults, {features}) : features;
    return result;
  }),

  blockCopyLogged : [],

  /** map the given feature JSON values to store object references.
   */
  pushFeatureSearchResults : function(apiServer, featureValues) {
    let fnName = 'pushFeatureSearchResults',
    pathsPro = this.get('pathsPro'),
    flowsService = this.get('flowsService');
    let store = apiServer.store;

    let features =
      featureValues.map((f) => {
        /** replace f.block with a reference to the block in store.
         * The blocks and datasets are already loaded.
         */
        let
          storefb = this.get('apiServers').id2Store(f.block.id),
        block = store.peekRecord('block', f.block.id),
        fBlock = f.block;
        let feature;
        /** filter out result features whose blocks are copies. */
        if (! storefb && block.isCopy) {
          feature = undefined;
          /* limit trace : only report each block once */
          if (! this.blockCopyLogged.includes(block)) {
            this.blockCopyLogged.addObject(block);
            dLog(fnName, 'result feature is a copy', f, block.brushName, block.id, block._meta._origin, store && store.name);
          }
        }
        else {
          if (store !== storefb) {
            dLog(fnName, apiServer, store && store.name, '!==', storefb && storefb.name, f.block.id);
          }
          if (f.blockId !== f.block.id) {
            dLog(fnName, f.blockId, '!==', f.block.id);
          }
          else if (! block && storefb && (block = storefb.peekRecord('block', f.block.id))) {
            dLog(fnName, f.block, 'not in store of request server', store, 'using', storefb);
            store = storefb;
          }
          else if (! block) {
            dLog(fnName, f.block, 'not in store', store, storefb);
          }
          else
            f.block = block;

          feature = store.peekRecord('feature', f.id);
          if (get(fBlock, '_meta._origin')) {
            dLog(fnName, 'result feature is a copy', f, fBlock._meta._origin, fBlock);
            // expect that feature is undefined, which is filtered out.
          }
          else if (! feature) {
            if (f._id === undefined)
              f._id = f.id;
            feature = 
              pathsPro.pushFeature(store, f, flowsService);
            if (! feature)
              dLog(fnName, f, 'push failed');
          }
        }
        return feature;
      })
      // filter out undefined features
      .filter((f) => f);
    dLog(fnName, featureValues, features);
    return features;
  },


  /** @return list of references (blocks) of viewed blocks */
  viewedBlocksReferences : computed(
    'viewed.[]',
    function () {
      let viewed = this.get('viewed'),
      blocksReferences = this.blocksReferences(viewed, true);

      if (trace_block > 1)
        console.log(
          'viewedBlocksReferences', blocksReferences
            .map(this.blocksReferencesText)
        );
      return blocksReferences;
  }),

  /** @return an array of pairs [axis1d, axis1d.referenceBlock]
   */
  axis1dReferenceBlocks : computed(
    'axes1d.axis1dArray.[]',
    function() {
      let blocks = this.get('axes1d').get('axis1dArray')
          .map((axis1d) => [axis1d, axis1d.get('referenceBlock')]);
      dLog('axis1dReferenceBlocks', blocks);
      return blocks;
    }),
  /** collate references (blocks) of viewed blocks
   * @return map from reference (block object) to [block object]
   * @desc
   * Similar : axesBlocks (components/draw/axes-1d.js) which maps from
   * referenceBlockId to [block, ..].
   */
  axesViewedBlocks2 : computed(
    'viewedBlocksReferences.[]',
    function () {
      const fnName = 'axesViewedBlocks2';
      let br = this.get('viewedBlocksReferences'),
      map = br.reduce(
        (map, id_obj) => {
          let id = id_obj.id,
          referenceBlock = id_obj.obj;
          let blocks = map.get(referenceBlock);
          if (! blocks)
            map.set(referenceBlock, blocks = []);
          let block = this.peekBlock(id);
          if (! block) {
            dLog(fnName, id, 'not found', id_obj);
          } else
          if (blocks.indexOf(block) < 0)
            blocks.push(block);
          return map; },
        new Map()
      );
      console.log('axesViewedBlocks2', map, br, br.map(this.blocksReferencesText));
      return map;
  }),

  /** @return Map of stacks to axes (ie. of viewed blocks). */
  stacksAxes : computed(
    'viewedBlocksReferences.@each.axis',
    function () {
      let viewedBlocksReferences = this.get('viewedBlocksReferences'),
      stacksAxes = viewedBlocksReferences.reduce(
        (map, blockIO) => {
          let block = blockIO.obj,
          axis = block.get('axis'),
          stack = axis && axis.getStack();
          if (stack) {
            let axes = map.get(stack);
            if (! axes)
              map.set(stack, axes = []);
            axes.push(axis);
          }
          return map; },
        new Map()
      );
      return stacksAxes;
    }),
  /** This does not have a dependency on stacks.length, so it does not update.
   * Replaced by stacksCount, following.
   */
  stacksCount_unused : alias('stacksAxes.size'),
  stacksCountObj : computed(function () {
    /** lazy evaluation - hopefully .stacksCount is  */
    let obj = stacks.stacksCount;
    if (! obj)
      dLog('stacksCountObj', obj, stacks);
    return obj;
  }),
  stacksCount : alias('stacksCountObj.count'),
  stacksWidthsSum : alias('stacksCountObj.widthsSum'),
  axesExtendedCount : alias('stacksCountObj.extendedCount'),
  axes2d : alias('stacksCountObj.axes2d'),

  /** From the list of viewed loaded blocks, filter out those which are not data
   * blocks.
   * @return array of blocks
   */
  loadedViewedChildBlocks: computed(
    'viewed.@each.{isViewed,isLoaded,hasFeatures}',
    function() {
      let records =
        this.get('viewed')
        .filter(function (block) {
          /** see comment re. hasFeatures, isData{,Count} in @see mayHaveFeatures */
          return block.get('isLoaded') // i.e. !== undefined
            && block.get('mayHaveFeatures');
        });
      if (trace_block > 1)
        console.log(
          'viewed', this.get('viewed'),
          'loadedViewedChildBlocks', records
            .map(function(blockR) { return blockR.view && blockR.view.longName(); })
        );
      return records;  // .toArray()
    }),

  /** Lookup the axis of block, and if none then use ensureAxis().
   */
  blockAxis(block) {
    let axis = block.get('axis');
    if (! axis && block.get('isViewed')) {
      this.ensureAxis(block);
      axis = block.get('axis');
      console.log('blockAxis', block.id, axis);
    }
    return axis;
  },
  /** Call axisApi.ensureAxis() for block. */
  ensureAxis(block) {
    breakPoint('axis-1d:ensureAxis');
    /* stacks-view will map URL params configuring stacks for viewed blocks to
     * rendered DOM elements with associated Stack .__data and these 2 functions
     * (blockAxis and ensureAxis) can be absorbed into that.
     */
    let oa = stacks.oa, axisApi = oa.axisApi;
    axisApi.cmNameAdd(oa, block);
    console.log('ensureAxis', block.get('id'));
    // draw_orig
  },
  /** Collate the viewed blocks by their parent block id, or by their own block
   * id if they are not parented.
   * @return Map : blockId -> [block]
   */
  dataBlocks : computed(
    /** loadedViewedChildBlocks is filtered by .@each.mayHaveFeatures */
    'loadedViewedChildBlocks',
    function () {
      let records = this.get('loadedViewedChildBlocks'),
      map = records.reduce(
        function (map, block) {
          let referenceBlock = block.get('referenceBlock'),
           id = referenceBlock ? referenceBlock.get('id') : block.get('id');
          if (! id) {
            console.log('dataBlocks', block.id, referenceBlock);
          }
          else {
            let blocks = map.get(id);
            if (! blocks)
              map.set(id, blocks = []);
            /* non-data (reference) blocks are map indexes, but are not put in
             * the dataBlocks array. */
            blocks.push(block);
          }
          return map; },
        new Map()
      );

      console.log('dataBlocks', map);
      return map;
    })

});
