import { allSettled } from 'rsvp';
import { throttle } from '@ember/runloop';
import { alias } from '@ember/object/computed';

import Service, { inject as service } from '@ember/service';

import { task, didCancel } from 'ember-concurrency';

import { stacks, Stacked } from '../../utils/stacks';
import { storeFeature } from '../../utils/feature-lookup';
import { updateDomain } from '../../utils/stacksLayout';

import {
           addPathsToCollation, addPathsByReferenceToCollation,
         storePath
       } from "../../utils/draw/collate-paths";

import { blockAdjKeyFn } from '../../utils/draw/stacksAxes';
import { promiseText } from '../../utils/ember-devel';

/*----------------------------------------------------------------------------*/

let trace_pathsP = 0;

/* global Promise */

const dLog = console.debug;

//------------------------------------------------------------------------------

/** transitioning to driving this calc from the Ember runloop instead of from the API response. */
const blocksUpdateDomainEnabled = false;

function verifyFeatureRecord(fr, f) {
  let frd = fr._internalModel.__data || fr._internalModel .__recordData.__data,
  /** Handle some older data which has .range instead of .value */
  frdv = frd ? frd.value || frd.range : fr.get('value'),
  fv = f.value || f.range;
  if ((typeof(frdv) == "number") || (frdv.length === undefined))
    frdv = [frdv];
  if ((typeof(fv) == "number") || (frdv.length === undefined))
    frdv = [fv];
  /** @return 1 if end of interval matches forward, -1 if reverse, 0 if not match. */
  function sameOrReverse(i) { return (frdv[i] === fv[i]) ? 1 : (frdv[i] === fv[1-i]) ? -1 : 0; }
  /** if sameValue is true then sameDirection is implied, so not tested. */
  let sameValue = (fv.length === 1) && (frdv[0] === fv[0]) &&
      ((frdv.length === 1) || (frdv[0] === frdv[1])) ;
  let
    /** direction indicated by frdv[0]. */
    direction = sameOrReverse(0),
  /** true if not an interval, or other end of interval matches in same direction. */
  sameDirection = sameValue || (frdv.length < 2) || (sameOrReverse(1) === direction),
  same = 
    (fr.id === f._id) &&
    direction && sameDirection &&
    ((frd ? frd._name : fr.get('name')) === (f.name || f._name));
  return same;
}


//------------------------------------------------------------------------------

export default Service.extend({
  auth: service('auth'),
  store: service(),
  flowsService: service('data/flows-collate'),
  blockService : service('data/block'),
  apiServers : service(),
  controls : service(),

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
        /** intervalParams() will interpret domain : [0,0] as undefined, i.e. request from the whole domain. */
        return axis ? axis.axisDimensions() : { domain : [0,0], /*range:,*/ zoomed : false};
      });
    return intervals;
  },
  pathsDensityParams : alias('controls.view.pathsDensityParams'),
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
    let apiServers = this.get('apiServers'),
    blockAdjIdRemote = blockAdjId.map((blockId) => apiServers.id2RemoteRefn(blockId));
    /** names 'blockA', 'blockB' are 
     * just for passing to auth getPathsViaStream, getPathsProgressive, will change signature of those functions. */
    let blockA = blockAdjIdRemote[0], blockB = blockAdjIdRemote[1];

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
              blockId = res[i].alignment[j].blockId,
              store = me.get('apiServers').id2Store(blockId),
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
          throttle(
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

  /** Push the feature into the store if it is not already there.
   * @return the record handle of the existing or added feature record.
   * @param flowsService  optional, defaults to this.get('flowsService').
   */
  pushFeature(store, f, flowsService) {
    flowsService ||= this.get('flowsService');
    let c;
    let fr = store.peekRecord('feature', f._id);
    if (fr) {
      let verifyOK = verifyFeatureRecord(fr, f);
      if (! verifyOK)
        dLog('peekRecord feature', f._id, f, fr._internalModel.__data, fr);
      c = fr;
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
      // equivalent : (typeof blockId !== "string")
      if (blockId.get) {
        blockId = blockId.get('id');
      }
      if (trace_pathsP > 3)
        dLog('pushFeature', f.blockId, c.get('blockId.features.length'), c.get('blockId.featuresLength'), f, 'featuresLength');
      /** if feature has no ._name, i.e. datasetId.tags[] contains "AnonFeatures",
       * then use e.g. "1H:" + value[0]
       */
      let fName = f._name || (c.get('blockId.name') + ':' + f.value[0]);
      storeFeature(stacks.oa, flowsService, fName, c, blockId);
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
      // update the paths{,Aliases}ResultLength -Debounced and -Throttled values
      exists.updatePathsResult(resultFieldName, pathsResult);
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
    let me = this;
    let flowsService = this.get('flowsService');

    let
    intervals = blockAdj.get('axisDimensions'),
    intervalParams = this.intervalParams(intervals);

    let drawMap = stacks.oa.eventBus;
    let pathsViaStream = drawMap.get('controls').view.pathsViaStream;

    let blockA = blockAdjId[0], blockB = blockAdjId[1];
    let apiServers = this.get('apiServers'),
    blockAdjIdRemote = blockAdjId.map((blockId) => apiServers.id2RemoteRefn(blockId));
    let auth = this.get('auth');
    let promise = 
      // original API, non-progressive  
      // auth.getPaths(blockA, blockB, /*withDirect*/ false, /*options*/{})
      pathsViaStream ?
      auth.getPathsAliasesViaStream(blockAdjIdRemote, intervalParams, {dataEvent : receivedData, closePromise : taskInstance}) :
    auth.getPathsAliasesProgressive(blockAdjIdRemote, intervalParams, {});

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
              let store = me.get('apiServers').id2Store(f.blockId);
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
          throttle(
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
   * @param all true means request all features of the block
   */
  getBlockFeaturesInterval(blockId, all) {
    const fnName = 'getBlockFeaturesInterval';
    if (trace_pathsP)
      dLog(fnName, blockId);
    let block = this.get('blockService').peekBlock(blockId);
    let features;
    if (! block) {
      dLog(fnName, ' not found:', blockId);
    }
    else {
      /** blockId === block.id. so param blockId might be dropped, having moved
       * getBlockFeaturesIntervalTask() from this service to models/block.js */
      let t = block.get('getBlockFeaturesIntervalTask');
      features = t.perform(blockId, all)
        .catch((error) => {
          let lastResult;
          // Recognise if the given task error is a TaskCancelation.
          if (! didCancel(error)) {
            dLog(fnName, 'taskInstance.catch', blockId, error);
            throw error;
          } else {
            lastResult = t.get('lastSuccessful.value');
            // .lastRunning seems to be always null.
            dLog(
              fnName, 'using lastSuccessful.value', lastResult || t.lastSuccessful, 
              t.get('state'), t.numRunning, t.numQueued, t.lastRunning
            );
          }
          return lastResult;
        });

      features
        .then(function (features) {
          if (trace_pathsP)
            dLog("getBlockFeaturesIntervalTask", blockId, all, features);
        });
    }
    return features;
  },



  /**
   * @param blockA  blockID
   * @param all true means request all features of the block
   * @return  promise yielding paths result
   */
  requestBlockFeaturesInterval(blockA, all) {
    /** used in trace */
    const apiName = 'blockFeaturesInterval';
    /** blockA is the referenceBlock of the axis, so its store is not used to store the features of the dataBlockIds */
    const apiServers = this.get('apiServers');

    let me = this;
    let flowsService = this.get('flowsService');
    let intervalParams;
    if (all) {
      intervalParams = {
        axes : [{range: 878, zoomed: false}],
        nSamples : null};
    } else {
      let interval = this.axisDimensions([blockA]);
      intervalParams = this.intervalParams(interval);
    }
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
    if (! brushedDomain  || ((brushedDomain[0] === 0) && (brushedDomain[1] === 0))) {
      if (paramAxis.domain && (paramAxis.domain[0] === 0) && (paramAxis.domain[1] === 0)) {
        delete paramAxis.domain;
      }
    }
    else if (brushedDomain)
      paramAxis.domain = brushedDomain;
    let dataBlockIds =
        all ? [blockA] :
        axis.dataBlocks(true, false)
        .filter((blockS) => blockS.block.get('isBrushableFeatures'))
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
            let store = apiServers.id2Store(res[i].blockId);
            me.pushFeatureField(store, res, i, flowsService);
          }
          // possibly accumulate the result into axis-brush in the same way that 
          // requestPathsProgressive() above accumulates paths results into blockAdj

          let domainCalc = true,
          axisEvents = false;

          if (blocksUpdateDomainEnabled)
          throttle(
            me, me.blocksUpdateDomain, 
            requestBlockIds, domainCalc,
            200, false);
          // res is returned as the promise result
          return res;
        };
    promise = 
    promise
      .then(
        receivedData,
        function(err, status) {
          // if (pathsViaStream)
          //  dLog(apiName, ' request', 'pathsViaStream', blockA, me, err, status);
          // else
            dLog(apiName, ' request', blockA, me, err?.responseJSON[status] /* .error.message*/, status);
        });
      return promise;
    });
    let promise = allSettled(promises);
    return promise;

  }


});
