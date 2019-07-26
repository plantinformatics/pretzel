import Ember from 'ember';

import Service from '@ember/service';
const { inject: { service } } = Ember;

import { task } from 'ember-concurrency';

import { stacks, Stacked } from '../../utils/stacks';
import { storeFeature } from '../../utils/feature-lookup';
import { updateDomain } from '../../utils/stacksLayout';

import {
           addPathsToCollation, addPathsByReferenceToCollation,
         storePath
       } from "../../utils/draw/collate-paths";

let trace_pathsP = 1;

import { blockAdjKeyFn } from '../../utils/draw/stacksAxes';

/* global Promise */

//------------------------------------------------------------------------------

function verifyFeatureRecord(fr, f) {
  let frd = fr._internalModel.__data,
  /** Handle some older data which has .range instead of .value */
  frdv = frd.value || frd.range,
  fv = f.value || f.range,
  same = 
    (fr.id === f._id) &&
    (frdv[0] === fv[0]) &&
    ((frdv.length < 2) || (frdv[1] === fv[1])) &&
    (frd.name === f.name);
  return same;
}

/** Used when result paths is a promise;  simply shows 'pending'.
 */
function promiseText(promise) {
  // Some types of promise used may have not .state().
  return (promise.state && promise.state()) || promise;
}

//------------------------------------------------------------------------------

export default Service.extend({
  auth: service('auth'),
  store: service(),
  flowsService: service('data/flows-collate'),

  /** set up a block-adj object to hold results. */
  ensureBlockAdj(blockAdjId) {
    let store = this.get('store'),
    blockAdjIdText = blockAdjKeyFn(blockAdjId),
    r = store.peekRecord('blockAdj', blockAdjIdText);
    if (r)
      console.log('ensureBlockAdj', blockAdjId, r._internalModel.__attributes, r._internalModel.__data);
    if (! r) {
      let ba = {
        type : 'block-adj',
        id : blockAdjIdText,
        relationships : {
          block0 : { data: { type: "block", "id": blockAdjId[0] } },
          block1 : { data: { type: "block", "id": blockAdjId[1] } }
        },
        attributes : {
          'block-id0' : blockAdjId[0],
          'block-id1' : blockAdjId[1]
        }
      };
      let
      ban = store.normalize('blockAdj', ba);
      r = store.push(ban);
      if (! r.get('blockId0')) {
        debugger;
        r.set('blockId0', blockAdjId[0]);
      }
      if (! r.get('blockId1'))
        r.set('blockId1', blockAdjId[1]);
    }
    return r;
  },
  findBlockAdj(blockAdjId) {
    let
      store = this.get('store'),
    blockAdj =
      store.peekRecord('block-adj', blockAdjKeyFn(blockAdjId));
    if (! blockAdj)
    {
      /** this is now done in ensureBlockAdj(), before the request. */
      console.log('blockAdj not found', blockAdj, blockAdjId);
    }
    return blockAdj;
  },

  /** Paths returned from API, between adjacent blocks,
   * are stored in ember data store, as block-adj.
   * Initially just a single result for each blockID pair,
   * but will later hold results for sub-ranges of each block, at different resolutions.
   */
  getPathsProgressive(blockAdj, blockAdjId, taskInstance) {
    console.log('getPathsProgressive', blockAdj, blockAdjId);
    let paths;
    if (! blockAdj)
      blockAdj = this.findBlockAdj(blockAdjId);
    if (! blockAdj) {
      console.log('getPathsProgressive not found:', blockAdjId);
    }
    else {  // this can move to models/block-adj
      let domainChange = blockAdj.get('domainChange');
      let result;
      if (! domainChange && ((result = blockAdj.get('pathsResult')))) {
        paths = Promise.resolve(result);
      }
      else
        paths = this.requestPathsProgressive(blockAdj, blockAdjId, taskInstance);
      console.log('getPathsProgressive', blockAdj, blockAdjId, result || promiseText(paths));
    }
    return paths;
  },
  /** can move to draw/axis-1d.js */
  axisDimensions(blockAdj) {
    let 
      intervals =
      blockAdj.map(function (blockId) {
      let axis = Stacked.getAxis(blockId);
      return axis.axisDimensions();
      });
    return intervals;
  },
  controls : Ember.computed(function () {
    let oa = stacks.oa,
    /** This occurs after mapview.js: controls : Ember.Object.create({ view : {  } }),
     * and draw-map : draw() setup of  oa.drawOptions.
     * This can be replaced with a controls service.
     */
    controls = oa.drawOptions.controls;
    return controls;
  }),
  pathsDensityParams : Ember.computed.alias('controls.view.pathsDensityParams'),
  /** Determine the parameters for the paths request, - intervals and density.
   * @param intervals domain for each blockAdj
   */
  intervalParams(intervals) {
    let
    page = { },
    noDbPathFilter = stacks.oa.eventBus.get('params.parsedOptions.noDbPathFilter'),
    /** default value is true, i.e. noDbPathFilter===undefined => dbPathFilter */
    dbPathFilter = ! noDbPathFilter,
    params = {axes : intervals, page,  dbPathFilter };
    intervals.forEach(function (i) {
      // console.log(i.domain);
      // Block : domain may be [false, false] before Block features are known. ?
      if (i.domain && (i.domain[0] === false) && (i.domain[1] === false)) {
        console.log('intervalParams, empty Block ?', i.domain);
      }
      if (i.domain && (i.domain[0] === 0) && (i.domain[1] === 0))
        i.domain = undefined;
    } );

    let vcParams = this.get('pathsDensityParams');
    if (vcParams.nSamples) {
      params.nSamples = vcParams.nSamples;
    }
    if (vcParams.densityFactor) {
      page.densityFactor = vcParams.densityFactor;
      page.thresholdFactor = vcParams.densityFactor; // retire the name .thresholdFactor
    }
    if (vcParams.nFeatures) {
      params.nFeatures = vcParams.nFeatures;
    }

    return params;
  },
  /**
   * @param blockAdj  defines the scope of the request; result is stored here.
   * @param blockAdjId  array of 2 blockIDs which identify blockAdj
   * @return  promise yielding paths result
   */
  requestPathsProgressive(blockAdj, blockAdjId, taskInstance) {
    /** just for passing to auth getPathsViaStream, getPathsProgressive, will change signature of those functions. */
    let blockA = blockAdjId[0], blockB = blockAdjId[1];
    let store = this.get('store');

    // based on link-path: request()
    let me = this;
    let flowsService = this.get('flowsService');
    let blockAdjIdText,
    exists = blockAdj || this.findBlockAdj(blockAdjId),
    intervals = blockAdj.get('axisDimensions'),
     intervalParams = this.intervalParams(intervals);
    exists.set('intervalParams', intervalParams);

    let drawMap = stacks.oa.eventBus;
    let pathsViaStream = drawMap.get('controls').view.pathsViaStream;
    let promise = 
      pathsViaStream ?
      this.get('auth').getPathsViaStream(blockA, blockB, intervalParams, /*options*/{dataEvent : receivedData, closePromise : taskInstance}) :
      this.get('auth').getPathsProgressive(blockA, blockB, intervalParams, /*options*/{});

        function receivedData(res){
          if (! res || ! res.length)
            return;
          if (trace_pathsP > 1)
            console.log('path request then', res.length);
          for (let i=0; i < res.length; i++) {
            for (let j=0; j < 2; j++) {
              let repeats = res[i].alignment[j].repeats,
              // possibly filterPaths() is changing repeats.features[] to repeats[]
              features = repeats.features || repeats,
              f = features[0];
              me.pushFeature(store, f, flowsService);
            }
          }
          /** Return unique result identifier */
          function resultIdName(res) { return res._id.name; }
          let firstResult =
            me.appendResult(blockAdj, 'pathsResult', pathsViaStream, res, resultIdName);

          /* if zooming in on a pre-existing axis, then don't trigger zoomedAxis
           * event, and no need for domainCalc() except when there was no
           * previous pathsResult, or if streaming and receiving results for the first request.
           */
          let domainCalc = pathsViaStream || firstResult,
          axisEvents = ! exists;

          /* check if passing blockAdjId prevents the merging of multiple calls
           * to throttle with the same arguments into a single call.
           */
          Ember.run.throttle(
            me, me.blocksUpdateDomain, 
            blockAdjId, domainCalc, axisEvents,
            200, false);
        };

    promise
      .then(
        receivedData,
        function(err, status) {
          if (pathsViaStream)
            console.log('path request', 'pathsViaStream', blockA, blockB, me, err, status);
          else
          console.log('path request', blockA, blockB, me, err.responseJSON[status] /* .error.message*/, status);
        });
    return promise;
  },

  pushFeature(store, f, flowsService) {
    let fr = store.peekRecord('feature', f._id);
    if (fr) {
      let verifyOK = verifyFeatureRecord(fr, f);
      if (! verifyOK)
        console.log('peekRecord feature', f._id, f, fr._internalModel.__data, fr);
    }
    else
    {
      f.id = f._id;
      let fn = store.normalize('feature', f);
      let c = store.push(fn);
      storeFeature(stacks.oa, flowsService, f.name, c, f.blockId);
      if (trace_pathsP > 2)
        console.log(c.get('id'), c._internalModel.__data);
    }

  },

  /**
   * @param res may be []; it's not clear there is any point in calling
   * appendResult() in that case, except if ! pathsViaStream then it will set
   * exists.`resultFieldName` to [], which may have some value.
   */
  appendResult(blockAdj, resultFieldName, pathsViaStream, res, resultIdName) {
    let exists = blockAdj;
    let pathsResult = exists.get(resultFieldName),
    firstResult = !(pathsResult && pathsResult.length);
    if (pathsViaStream) {
      if (res.length) {
        let pathsAccumulated = pathsResult || [];
        // console.log('exists ', resultFieldName, exists.get(resultFieldName), pathsAccumulated.length, res.length);
        /** Currently the API result may overlap previous results. */
        let resIdName = resultIdName(res[0]);
        let i = pathsAccumulated.findIndex(function (r) { return resultIdName(r) === resIdName; } );
        if (i === -1) {
          pathsResult = pathsAccumulated.concat(res);
          if (pathsAccumulated.length < 3)
            console.log('pathsAccumulated', pathsAccumulated, res);
        }
      }
    }
    else
      pathsResult = res;
    if (res.length || ! pathsViaStream) {
      exists.set(resultFieldName, pathsResult);
      if (trace_pathsP > 1 + pathsViaStream)
        console.log(resultFieldName, pathsResult, exists, exists._internalModel.__attributes, exists._internalModel.__data);
    }

    return firstResult;
  },

  /** Update the domain of the named blocks.
   * @param blocks  array of blockId
   * @param domainCalc  if false, do nothing (useful because this function is called via throttle().
   * @param axisEvents  not used - axisEvents is factored to axis-1d : notifyChanges()
   */
  blocksUpdateDomain : function(blocks, domainCalc, axisEvents) {

          if (domainCalc)
            blocks.map(function (blockId) {
              let
                block = stacks.blocks[blockId];
              console.log(blockId, 'before domainCalc, block.z', block.z); let
              /** updateDomain() uses axis domainCalc() but that does not recalculate block domain. */
              blockDomain = block.domain = block.domainCalc(),
              axis = Stacked.getAxis(blockId);
              if (! axis) {
                // This can occur when axis is being deleted by the time the result arrives.
                if ((axis = stacks.axesP [blockId])) {
                  console.log('blocksUpdateDomain', blocks, blockId, axis);
                  block.log(); axis.log();
                }
              }
              else {
              /** axis domainCalc() also does not re-read the block's domains if axis.domain is already defined. */
                let
              axisDomain = axis.domain = axis.domainCalc();
              console.log(blockId, 'blockDomain', blockDomain, axisDomain, block.z);

              // if zoomed in, then extension to the block's domain does not alter the viewed domain.
              if (! axis.axis1d.zoomed) {
                axis.axis1d.updateDomain();
              }
              }

          });
  },

  /* above : paths : direct */
  /*--------------------------------------------------------------------------*/
  /* aliases */

  getPathsAliasesProgressive(blockAdj, blockAdjId, taskInstance) {
    console.log('getPathsAliasesProgressive', blockAdj, blockAdjId);
    let pathsAliases;
    if (! blockAdj)
      blockAdj = this.findBlockAdj(blockAdjId);
    if (! blockAdj) {
      console.log('getPathsAliasesProgressive not found:', blockAdjId);
    }
    else {
      let flowsService = this.get('flowsService'),
      flows = flowsService.get('flows'),
      multipleApis = flows.alias.visible && flows.direct.visible;
      /* If both direct & aliases flows are enabled, then this check will return
       * domainChange === false because the blockAdj.intervalParams is recorded
       * by requestPathsProgressive(), and so at this point
       * blockAdj.intervalParams.axes[*].domain will equal
       * axisDimensions()[*].domain.
       * To enable this, considering (next commit) : each API can have a
       * separate copy of .intervalParams in blockAdj.
       */
      let domainChange = multipleApis || blockAdj.get('domainChange');
      let result;
      if (! domainChange && ((result = blockAdj.get('pathsAliasesResult')))) {
        pathsAliases = Promise.resolve(result);
      }
      else
        pathsAliases = this.requestAliases(blockAdj, blockAdjId, taskInstance);
      console.log('getPathsAliasesProgressive', blockAdj, blockAdjId, result || promiseText(pathsAliases));
    }
    return pathsAliases;
  },

  requestAliases : function (blockAdj, blockAdjId, taskInstance) {
    let reqName = 'path alias request';
    if (trace_pathsP > 2)
      console.log(reqName, blockAdjId);
    let store = this.get('store');
    let me = this;
    let flowsService = this.get('flowsService');

    let
    intervals = blockAdj.get('axisDimensions'),
    intervalParams = this.intervalParams(intervals);

    let drawMap = stacks.oa.eventBus;
    let pathsViaStream = drawMap.get('controls').view.pathsViaStream;

    let blockA = blockAdjId[0], blockB = blockAdjId[1];
    let auth = this.get('auth');
    let promise = 
      // original API, non-progressive  
      // auth.getPaths(blockA, blockB, /*withDirect*/ false, /*options*/{})
      pathsViaStream ?
      auth.getPathsAliasesViaStream(blockAdjId, intervalParams, {dataEvent : receivedData, closePromise : taskInstance}) :
    auth.getPathsAliasesProgressive(blockAdjId, intervalParams, {});

        function receivedData(res) {
          if (! res || ! res.length)
            return;
          if (trace_pathsP > 1)
            console.log('path request then', res.length);
          if (false)
            me.pushAlias(res);

          if (trace_pathsP > 2 - (res.length > 1))
            console.log('featureAObj', res[0].featureAObj, res[0].featureBObj, res[0], res);
          /** true if result is from pathsAliases() (via dbLookupAliases()), otherwise from apiLookupAliases(). */
          let fromMongoQuery = (res.length && res[0].aliased_features) !== undefined;
          if (fromMongoQuery) {
            let resOrig = res;
            res = res.map(function (r) {
              let ro = {
                featureA: r.aliased_features[0]._id,
                featureB: r.aliased_features[1]._id,
                // could append r.aliased_features[1].feature_aliases, but it should be identical
                aliases: [r.aliased_features[0].feature_aliases],
                featureAObj : r.aliased_features[0],
                featureBObj : r.aliased_features[1]};
              return ro;
            });
          }

          res.forEach(function (r) {
            [r.featureAObj, r.featureBObj].forEach(function (f) {
              if (f._id === undefined)
                f._id = f.id;
              me.pushFeature(store, f, flowsService);
            });
          });
          addPathsToCollation(blockA, blockB, res);

          function resultIdName(res) { return res.featureA + '_' + res.featureB; }
          let firstResult =
            me.appendResult(blockAdj, 'pathsAliasesResult', pathsViaStream, res, resultIdName);

        }

    promise.catch(function (err, status) {
      console.log(reqName, 'pathsAliasesViaStream', blockAdjId, 'catch', me, err, status);
    });

    promise
      .then(
        receivedData,
        function(err, status) {
          if (pathsViaStream)
            console.log(reqName, 'pathsAliasesViaStream', blockAdjId, me, err, status);
          else
          console.log(reqName, blockAdjId, me, err.responseJSON[status] /* .error.message*/, status);
        });
    return promise;
  },

  pushAlias : function (pathsAliases) {
    // if (trace_pathsP > 2)
      console.log('path push', pathsAliases.length);
    let pushData = 
      {
        data: {
          id: id,
          type: 'alias',
          attributes: pathsAliases
        }
      };
    this.get('store').push(pushData);
  },



  /*--------------------------------------------------------------------------*/
  /* features */

  /** set up an axis-brush object to hold results. */
  ensureAxisBrush(block) {
    let store = this.get('store'),
    typeName = 'axis-brush',
    axisBrushId = block.id,
    r = store.peekRecord(typeName, axisBrushId);
    if (r)
      console.log('ensureAxisBrush', block.id, r._internalModel.__attributes, r._internalModel.__data);
    if (! r) {
      let ba = {
        // type : typeName,
        id : axisBrushId,
        block : block.id
      };
      let
      serializer = store.serializerFor(typeName),
      modelClass = store.modelFor(typeName),
      // ban1 = serializer.normalizeSingleResponse(store, modelClass, ba, axisBrushId, typeName),
      // ban1 = {data: ban1};
      // the above is equivalent long-hand for :
      ban = store.normalize(typeName, ba);
      r = store.push(ban);
    }
    return r;
  },

  /** Features returned from API, for the block,
   * are stored in ember data store, as an attribute of block.
   */
  getBlockFeaturesInterval(blockId) {
    let fnName = 'getBlockFeaturesInterval';
    console.log(fnName, blockId);
    let block = this.get('store').peekRecord('block', blockId);
    let features;
    if (! block) {
      console.log(fnName, ' not found:', blockId);
    }
    else {
        features = this.get('getBlockFeaturesIntervalTask').perform(blockId);
      features
        .then(function (features) {
          console.log("getBlockFeaturesIntervalTask", blockId, features);
        });
    }
    return features;
  },

  getBlockFeaturesIntervalTask : task(function* (blockId) {
    let
      fnName = 'getBlockFeaturesIntervalTask',
        features = yield this.requestBlockFeaturesInterval(blockId);
      console.log(fnName, blockId, promiseText(features));
    return features;
    /* tried .enqueue().maxConcurrency(3), but got 2 identical requests, so .drop() instead;
     * Perhaps later: split requestBlockFeaturesInterval() into parameter gathering and request;
     * the latter function becomes the task; store last request params with the corresponding task;
     * check request params against last and if match then return that task perform result.
     */
  }).drop(),



  /**
   * @param blockA  blockID
   * @return  promise yielding paths result
   */
  requestBlockFeaturesInterval(blockA) {
    /** used in trace */
    const apiName = 'blockFeaturesInterval';
    let store = this.get('store');

    let me = this;
    let flowsService = this.get('flowsService');
    let interval = this.axisDimensions([blockA]),
    intervalParams = this.intervalParams(interval);
    let drawMap = stacks.oa.eventBus;
    let pathsViaStream = drawMap.get('controls').view.pathsViaStream;
    let axis = Stacked.getAxis(blockA),
    axisBrush = me.get('store').peekRecord('axis-brush', blockA),
    brushedDomain = axisBrush.brushedDomain,
    paramAxis = intervalParams.axes[0];
    console.log('domain', paramAxis.domain, '-> brushedDomain', brushedDomain);
    /* When the block is first viewed, if it does not have a reference which
     * defines the range then the domain of the block's features is not known,
     * and the axis.domain[] will be [0, 0].
     */
    if ((brushedDomain[0] === 0) && (brushedDomain[1] === 0))
      delete paramAxis.domain;
    else
      paramAxis.domain = brushedDomain;
    let dataBlockIds = axis.dataBlocks(true)
     // equiv : blockS.block.get('id')
      .map(function (blockS) { return blockS.axisName; });
    let promise = 
      // streaming version not added yet
      // pathsViaStream ?
      // this.get('auth').getPathsViaStream(blockA, blockB, intervalParams, /*options*/{dataEvent : receivedData}) :
      this.get('auth').getBlockFeaturesInterval(dataBlockIds, intervalParams, /*options*/{});
        function receivedData(res){
          if (trace_pathsP > 1)
            console.log(apiName, ' request then', res.length);
          let firstResult;
          for (let i=0; i < res.length; i++) {
              let f = res[i];
              me.pushFeature(store, f, flowsService);
          }
          // possibly accumulate the result into axis-brush in the same way that 
          // requestPathsProgressive() above accumulates paths results into blockAdj

          let domainCalc = true,
          axisEvents = false;

          Ember.run.throttle(
            me, me.blocksUpdateDomain, 
            dataBlockIds, domainCalc, axisEvents,
            200, false);
        };
    promise
      .then(
        receivedData,
        function(err, status) {
          // if (pathsViaStream)
          //  console.log(apiName, ' request', 'pathsViaStream', blockA, me, err, status);
          // else
            console.log(apiName, ' request', blockA, me, err.responseJSON[status] /* .error.message*/, status);
        });
    return promise;

  }


});
