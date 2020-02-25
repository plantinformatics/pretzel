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

let trace_pathsP = 0;

import { blockAdjKeyFn } from '../../utils/draw/stacksAxes';

/* global Promise */

const dLog = console.debug;

//------------------------------------------------------------------------------

/** transitioning to driving this calc from the Ember runloop instead of from the API response. */
const blocksUpdateDomainEnabled = false;

function verifyFeatureRecord(fr, f) {
  let frd = fr._internalModel.__data,
  /** Handle some older data which has .range instead of .value */
  frdv = frd.value || frd.range,
  fv = f.value || f.range;
  if ((typeof(frdv) == "number") || (frdv.length === undefined))
    frdv = [frdv];
  if ((typeof(fv) == "number") || (frdv.length === undefined))
    frdv = [fv];
  let
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
      dLog('ensureBlockAdj', blockAdjId, r._internalModel.__attributes, r._internalModel.__data);
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
      if (false)
      r = store.push({data: ba});
      else {
      let
      ban = store.normalize('blockAdj', ba);
      r = store.push(ban);
        dLog('ensureBlockAdj', ban);
    }
      if (trace_pathsP)
        dLog('ensureBlockAdj', r, r.get('blockAdjId'), r._internalModel, r._internalModel.__data, store, ba);
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
      dLog('blockAdj not found', blockAdj, blockAdjId);
    }
    return blockAdj;
  },

  /** Paths returned from API, between adjacent blocks,
   * are stored in ember data store, as block-adj.
   * Initially just a single result for each blockID pair,
   * but will later hold results for sub-ranges of each block, at different resolutions.
   *
   * @param blockAdj  block-adj which owns the request and the result.
   * If undefined then the value is looked up from blockAdjId
   * @param blockAdjId  an array of 2 (string) blockIds.
   * Used when blockAdj===undefined, and also passed to blocksUpdateDomain().
   */
  getPathsProgressive(blockAdj, blockAdjId, taskInstance) {
    if (trace_pathsP)
      dLog('getPathsProgressive', blockAdj, blockAdjId);
    let paths;
    if (! blockAdj)
      blockAdj = this.findBlockAdj(blockAdjId);
    if (! blockAdj) {
      dLog('getPathsProgressive not found:', blockAdjId);
    }
    else {  // this can move to models/block-adj
      let domainChange = blockAdj.get('domainChange');
      let result;
      if (! domainChange && ((result = blockAdj.get('pathsResult')))) {
        paths = Promise.resolve(result);
      }
      else
        paths = this.requestPathsProgressive(blockAdj, blockAdjId, taskInstance);
      if (trace_pathsP)
        dLog('getPathsProgressive', blockAdj, blockAdjId, result || promiseText(paths));
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
      if (i.domain && ! i.domain.length)
        i.domain = undefined;
      // dLog(i.domain);
      // Block : domain may be [false, false] before Block features are known. ?
      if (i.domain && (i.domain[0] === false) && (i.domain[1] === false)) {
        dLog('intervalParams, empty Block ?', i.domain);
      }
      if (i.domain && (i.domain[0] === 0) && (i.domain[1] === 0))
        i.domain = undefined;
    } );

    if (this.get('fullDensity')) {
        params.nSamples = 1e6;
        page.densityFactor = 1e6;
        page.thresholdFactor = 1e6;
        params.nFeatures = 1e6;
    }
    else {
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
    }

    return params;
  },
  /**
   * @param blockAdj  defines the scope of the request; result is stored here.
   * @param blockAdjId  array of 2 blockIDs which identify blockAdj,
   * also used as param to blocksUpdateDomain().
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
            dLog('path request then', res.length);
          for (let i=0; i < res.length; i++) {
            for (let j=0; j < 2; j++) {
              let repeats = res[i].alignment[j].repeats,
              // possibly filterPaths() is changing repeats.features[] to repeats[]
              features = repeats.features || repeats;
              me.pushFeatureField(store, features, 0, flowsService);
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
          let domainCalc = pathsViaStream || firstResult;

          /* check if passing blockAdjId prevents the merging of multiple calls
           * to throttle with the same arguments into a single call.
           */
          if (blocksUpdateDomainEnabled)
          Ember.run.throttle(
            me, me.blocksUpdateDomain, 
            blockAdjId, domainCalc,
            200, false);
        };

    promise
      .then(
        receivedData,
        function(err, status) {
          if (pathsViaStream)
            dLog('path request', 'pathsViaStream', blockA, blockB, me, err, status);
          else
          dLog('path request', blockA, blockB, me, err.responseJSON[status] /* .error.message*/, status);
        });
    return promise;
  },

  pushFeature(store, f, flowsService) {
    let c;
    let fr = store.peekRecord('feature', f._id);
    if (fr) {
      let verifyOK = verifyFeatureRecord(fr, f);
      if (! verifyOK)
        dLog('peekRecord feature', f._id, f, fr._internalModel.__data, fr);
    }
    else
    {
      f.id = f._id;
      /** If f.value is not an array, replace it with an array.  This is a data
       * error, and this code is not intended to handle data errors, it just
       * works around an error in the current dev db.
       * Could do the same for .range, but not expecting any .range in new user data.
       */
      const valueF = 'value', fv = f[valueF];
      if ((typeof(fv) == "number") || (fv.length === undefined)) {
        dLog('Feature.value is expected to be an array, value is :', typeof(fv), f);
        f[valueF] = [fv];
      }
      let fn = store.normalize('feature', f);
      c = store.push(fn);
      let blockId = f.blockId;
      if (blockId.get)
	blockId = blockId.get('id');
      storeFeature(stacks.oa, flowsService, f.name, c, blockId);
      if (trace_pathsP > 2)
        dLog(c.get('id'), c._internalModel.__data);
    }
    return c;
  },
  /** wrapper around pushFeature() : push a feature value and replace the value with a record reference. */
  pushFeatureField(store, res, fieldName, flowsService) {
    let f = res[fieldName];
    let fr = this.pushFeature(store, f, flowsService);
    if (fr)
      res[fieldName] = fr;
    else if (trace_pathsP > 2)
      dLog('pushFeatureField', fieldName, f);
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
        // dLog('exists ', resultFieldName, exists.get(resultFieldName), pathsAccumulated.length, res.length);
        /** Currently the API result may overlap previous results. */
        let resIdName = resultIdName(res[0]);
        let i = pathsAccumulated.findIndex(function (r) { return resultIdName(r) === resIdName; } );
        if (i === -1) {
          pathsResult = pathsAccumulated.concat(res);
          if (pathsAccumulated.length < 3)
            if (trace_pathsP)
              dLog('pathsAccumulated', pathsAccumulated, res);
        }
      }
    }
    else
      pathsResult = res;
    if (res.length || ! pathsViaStream) {
      exists.set(resultFieldName, pathsResult);
      if (trace_pathsP > 1 + pathsViaStream)
        dLog(resultFieldName, pathsResult, exists, exists._internalModel.__attributes, exists._internalModel.__data);
    }

    return firstResult;
  },

  /** Update the domain of the named blocks.
   * @param blocks  array of blockId
   * @param domainCalc  if false, do nothing (useful because this function is called via throttle().
   */
  blocksUpdateDomain : function(blocks, domainCalc) {

          if (domainCalc)
            blocks.map(function (blockId) {
              let
                block = stacks.blocks[blockId];
              if (trace_pathsP)
                dLog(blockId, 'before domainCalc, block.z', block.z); let
              /** updateDomain() uses axis domainCalc() but that does not recalculate block domain. */
              blockDomain = block.domain = block.domainCalc(),
              axis = Stacked.getAxis(blockId);
              if (! axis) {
                // This can occur when axis is being deleted by the time the result arrives.
                if ((axis = stacks.axesP [blockId])) {
                  dLog('blocksUpdateDomain', blocks, blockId, axis);
                  block.log(); axis.log();
                }
              }
              else {
              /** axis domainCalc() also does not re-read the block's domains if axis.domain is already defined. */
                let
              axisDomain = axis.domain = axis.domainCalc();
                if (trace_pathsP)
                  dLog(blockId, 'blockDomain', blockDomain, axisDomain, block.z);

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

  /** 
   * @param blockAdj  block-adj which owns the request and the result.
   * If undefined then the value is looked up from blockAdjId
   * @param blockAdjId  an array of 2 (string) blockIds.
   * Used when blockAdj===undefined,
   * and may be passed to blocksUpdateDomain() when that call is added.
   */
  getPathsAliasesProgressive(blockAdj, blockAdjId, taskInstance) {
    if (trace_pathsP)
      dLog('getPathsAliasesProgressive', blockAdj, blockAdjId);
    let pathsAliases;
    if (! blockAdj)
      blockAdj = this.findBlockAdj(blockAdjId);
    if (! blockAdj) {
      dLog('getPathsAliasesProgressive not found:', blockAdjId);
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
      if (trace_pathsP)
        dLog('getPathsAliasesProgressive', blockAdj, blockAdjId, result || promiseText(pathsAliases));
    }
    return pathsAliases;
  },

  requestAliases : function (blockAdj, blockAdjId, taskInstance) {
    let reqName = 'path alias request';
    if (trace_pathsP > 2)
      dLog(reqName, blockAdjId);
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
            dLog('path request then', res.length);
          if (false)
            me.pushAlias(res);

          if (trace_pathsP > 2 - (res.length > 1))
            dLog('featureAObj', res[0].featureAObj, res[0].featureBObj, res[0], res);
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
            ['featureAObj', 'featureBObj'].forEach(function (fName) {
              let f = r[fName];
              if (f._id === undefined)
                f._id = f.id;
              me.pushFeatureField(store, r, fName, flowsService);
            });
          });
          addPathsToCollation(blockA, blockB, res);

          function resultIdName(res) { return res.featureA + '_' + res.featureB; }
          let firstResult =
            me.appendResult(blockAdj, 'pathsAliasesResult', pathsViaStream, res, resultIdName);

          let domainCalc = pathsViaStream || firstResult,
          axisEvents = ! blockAdj;
          if (blocksUpdateDomainEnabled)
          Ember.run.throttle(
            me, me.blocksUpdateDomain, 
            blockAdjId, domainCalc,
            200, false);

        }

    promise.catch(function (err, status) {
      if (trace_pathsP)
        dLog(reqName, 'pathsAliasesViaStream', blockAdjId, 'catch', me, err, status);
    });

    promise
      .then(
        receivedData,
        function(err, status) {
          if (pathsViaStream)
            dLog(reqName, 'pathsAliasesViaStream', blockAdjId, me, err, status);
          else
          dLog(reqName, blockAdjId, me, err.responseJSON[status] /* .error.message*/, status);
        });
    return promise;
  },

  pushAlias : function (pathsAliases) {
    if (trace_pathsP > 2)
      dLog('path push', pathsAliases.length);
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
    if (r && trace_pathsP)
      dLog('ensureAxisBrush', block.id, r._internalModel.__attributes, r._internalModel.__data);
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
    if (trace_pathsP)
      dLog(fnName, blockId);
    let block = this.get('store').peekRecord('block', blockId);
    let features;
    if (! block) {
      dLog(fnName, ' not found:', blockId);
    }
    else {
        features = this.get('getBlockFeaturesIntervalTask').perform(blockId);
      features
        .then(function (features) {
          if (trace_pathsP)
            dLog("getBlockFeaturesIntervalTask", blockId, features);
        });
    }
    return features;
  },

  getBlockFeaturesIntervalTask : task(function* (blockId) {
    let
      fnName = 'getBlockFeaturesIntervalTask',
        features = yield this.requestBlockFeaturesInterval(blockId);
      if (trace_pathsP)
        dLog(fnName, blockId, promiseText(features));
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
    /** There may not be an axis brush, e.g. when triggered by
     * featuresForAxis(); in this case : axisBrush is null; don't set
     * paramAxis.domain. */
    brushedDomain = axisBrush && axisBrush.brushedDomain,
    paramAxis = intervalParams.axes[0];
    if (trace_pathsP)
      dLog('domain', paramAxis.domain, '-> brushedDomain', brushedDomain);
    /* When the block is first viewed, if it does not have a reference which
     * defines the range then the domain of the block's features is not known,
     * and the axis.domain[] will be [0, 0].
     */
    if (! brushedDomain  || ((brushedDomain[0] === 0) && (brushedDomain[1] === 0)))
      delete paramAxis.domain;
    else if (brushedDomain)
      paramAxis.domain = brushedDomain;
    let dataBlockIds = axis.dataBlocks(true)
     // equiv : blockS.block.get('id')
      .map(function (blockS) { return blockS.axisName; });
    /** The result of passing multiple blockIds to getBlockFeaturesInterval()
     * has an unevenly distributed result : all the results come from just 1 of
     * the blockIds.  This is because of the implementation of $sample
     * (https://stackoverflow.com/a/46881483).
     * So instead getBlockFeaturesInterval() is called once for each blockId;
     * requestBlockIds is used in place of dataBlockIds.
     */
    let promises =
    dataBlockIds.map(function (blockId) {
      let requestBlockIds = [blockId];
    let promise = 
      // streaming version not added yet
      // pathsViaStream ?
      // this.get('auth').getPathsViaStream(blockA, blockB, intervalParams, /*options*/{dataEvent : receivedData}) :
      me.get('auth').getBlockFeaturesInterval(requestBlockIds, intervalParams, /*options*/{});
        function receivedData(res){
          if (trace_pathsP > 1)
            dLog(apiName, ' request then', res.length);
          let firstResult;
          for (let i=0; i < res.length; i++) {
              me.pushFeatureField(store, res, i, flowsService);
          }
          // possibly accumulate the result into axis-brush in the same way that 
          // requestPathsProgressive() above accumulates paths results into blockAdj

          let domainCalc = true,
          axisEvents = false;

          if (blocksUpdateDomainEnabled)
          Ember.run.throttle(
            me, me.blocksUpdateDomain, 
            requestBlockIds, domainCalc,
            200, false);
        };
    promise
      .then(
        receivedData,
        function(err, status) {
          // if (pathsViaStream)
          //  dLog(apiName, ' request', 'pathsViaStream', blockA, me, err, status);
          // else
            dLog(apiName, ' request', blockA, me, err.responseJSON[status] /* .error.message*/, status);
        });
    });
    let promise = Ember.RSVP.allSettled(promises);
    return promise;

  }


});
