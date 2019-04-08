import Ember from 'ember';

import Service from '@ember/service';
const { inject: { service } } = Ember;

import { stacks, Stacked } from '../../utils/stacks';
import { storeFeature } from '../../utils/feature-lookup';
import { updateDomain } from '../../utils/stacksLayout';

let trace_pathsP = 1;

import { blockAdjKeyFn } from '../../utils/draw/stacksAxes';

/* global Promise */

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
        type : 'blockAdj',
        id : blockAdjIdText,
        block0 : blockAdjId[0],
        block1 : blockAdjId[1],
        blockId0 : blockAdjId[0],
        blockId1 : blockAdjId[1]
      };
      let
      serializer = store.serializerFor('blockAdj'),
      modelClass = store.modelFor('blockAdj'),
      ban1 = serializer.normalizeSingleResponse(store, modelClass, ba, blockAdjIdText, 'blockAdj'),
      // the above is equivalent long-hand for :
      ban = store.normalize('blockAdj', ba);
      ban1 = {data: ban1};
      r = store.push(ban1);
    }
    return r;
  },

  /** Paths returned from API, between adjacent blocks,
   * are stored in ember data store, as block-adj.
   * Initially just a single result for each blockID pair,
   * but will later hold results for sub-ranges of each block, at different resolutions.
   */
  getPathsProgressive(blockAdj) {
    console.log('getPathsProgressive', blockAdj);
    let paths = this.get('store').peekRecord('block-adj', blockAdjKeyFn(blockAdj));
    if (! paths) {
      console.log('getPathsProgressive not found:', blockAdj);
    }
    else {  // this can move to models/block-adj
      let intervals = paths.get('intervalParams'),
      intervalsAxes = this.axisDimensions(blockAdj),
      domainsDiffer = function ()
      {
        let
        domainChanges = [0, 1].map(function (i) {
          let d = intervals.axes[i].domain,
          d2 = intervalsAxes[i].domain;
          return ((d === undefined) !== (d2 === undefined)) ||
            (d[0] !== d2[0]) || (d[1] !== d2[1]);
        });
        let change = domainChanges[0] || domainChanges[1];
        console.log('getPathsProgressive', intervals, intervalsAxes, domainChanges, change);
        return change;
      },
      domainChange = ! intervals || domainsDiffer();

      let result;
      if (! domainChange && ((result = paths.get('pathsResult')))) {
        paths = Promise.resolve(result);
      }
      else
        paths = this.requestPathsProgressive(blockAdj);
      console.log('getPathsProgressive', blockAdj, paths);
    }
    return paths;
  },
  axisDimensions(blockAdj) {
    let 
      intervals =
      blockAdj.map(function (blockId) {
      let axis = Stacked.getAxis(blockId);
      return axis.axisDimensions();
      });
    return intervals;
  },
  /** Determine the parameters for the paths request, - intervals and density.
   */
  intervals(blockAdj) {
    let intervals = this.axisDimensions(blockAdj),
    page = { },
    noDbPathFilter = stacks.oa.eventBus.get('params.parsedOptions.noDbPathFilter'),
    /** default value is true, i.e. noDbPathFilter===undefined => dbPathFilter */
    dbPathFilter = ! noDbPathFilter,
    params = {axes : intervals, page,  dbPathFilter };
    intervals.forEach(function (i) { 
      // console.log(i.domain);
      if ((i.domain[0] === 0) && (i.domain[1] === 0))
        i.domain = undefined;
    } );

    let oa = stacks.oa,
    controls = oa.drawOptions.controls;
    let sample = controls.get('view.pathControlActiveSample');
    if (sample) {
      params.nSamples = sample;
    }
    let densityFactor = controls.get('view.pathControlActiveDensity');
    if (densityFactor) {
      page.densityFactor = densityFactor;
      page.thresholdFactor = densityFactor; // retire the name .thresholdFactor
    }
    let nFeatures = controls.get('view.pathControlNFeatures');
    if (nFeatures) {
      params.nFeatures = nFeatures;
    }


    return params;
  },
  /**
   * @param blockAdj  array of 2 blockIDs
   * @return  promise yielding paths result
   */
  requestPathsProgressive(blockAdj) {
    let blockA = blockAdj[0], blockB = blockAdj[1];
    let store = this.get('store');

    // based on link-path: request()
    let me = this;
    let flowsService = this.get('flowsService');
    let intervalParams = this.intervals(blockAdj);
    let drawMap = stacks.oa.eventBus;
    let pathsViaStream = drawMap.get('controls').view.pathsViaStream;
    let promise = 
      pathsViaStream ?
      this.get('auth').getPathsViaStream(blockA, blockB, intervalParams, /*options*/{dataEvent : receivedData}) :
      this.get('auth').getPathsProgressive(blockA, blockB, intervalParams, /*options*/{});
        function receivedData(res){
          if (trace_pathsP > 1)
            console.log('path request then', res.length);
          let firstResult;
          for (let i=0; i < res.length; i++) {
            for (let j=0; j < 2; j++) {
              let repeats = res[i].alignment[j].repeats,
              // possibly filterPaths() is changing repeats.features[] to repeats[]
              features = repeats.features || repeats,
              f = features[0];
              me.pushFeature(store, f, flowsService);
            }
          }
          let blockAdjIdText = blockAdjKeyFn(blockAdj);
          let result = {
            type : 'blockAdj',
            id : blockAdjIdText,
            block0 : blockAdj[0],
            block1 : blockAdj[1],
            pathsResult : res
          };
          let exists = 
            store.peekRecord(result.type, blockAdjIdText);
          if (exists) {
            let pathsResult = exists.get('pathsResult');
            firstResult = !(pathsResult && pathsResult.length);
            if (pathsViaStream) {
              let pathsAccumulated = pathsResult || [];
              // console.log('exists pathsResult', exists.get('pathsResult'), pathsAccumulated.length, res.length);
              pathsResult = pathsAccumulated.concat(res);
            }
            else
              pathsResult = res;
            exists.set('pathsResult', pathsResult);
            exists.set('intervalParams', intervalParams);
            if (trace_pathsP > 1 + pathsViaStream)
              console.log('pathsResult', pathsResult, exists, exists._internalModel.__attributes, exists._internalModel.__data);
          }
          else {
          let n = store.normalize(result.type, result);
          let c = store.push(n);
          if (trace_pathsP > 2)
            console.log(n, c.get('block0'), c._internalModel.__data);
            c.set('intervalParams', intervalParams);
          }

          /* if zooming in on a pre-existing axis, then don't trigger zoomedAxis
           * event, and no need for domainCalc() except when there was no
           * previous pathsResult, or if streaming and receiving results for the first request.
           */
          let domainCalc = pathsViaStream || firstResult,
          axisEvents = ! exists;

          /* passing blockA, blockB as [blockA, blockB] would be neater but
           * might prevent the merging of multiple calls with the same arguments
           * into a single call.
           */
          Ember.run.throttle(
            me, me.blocksUpdateDomain, 
            [blockA, blockB], domainCalc, axisEvents,
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


  blocksUpdateDomain : function(blocks, domainCalc, axisEvents) {

          if (domainCalc)
            blocks.map(function (blockId) {
              let
                block = stacks.blocks[blockId];
              console.log(blockId, 'before domainCalc, block.z', block.z); let
              /** updateDomain() uses axis domainCalc() but that does not recalculate block domain. */
              blockDomain = block.domain = block.domainCalc(),
              axis = Stacked.getAxis(blockId),
              /** axis domainCalc() also does not re-read the block's domains if axis.domain is already defined. */
              axisDomain = axis.domain = axis.domainCalc();
              console.log(blockId, 'blockDomain', blockDomain, axisDomain, block.z);

              if (! axis.zoomed) {
                axis.updateDomain();
              }

          });
  },

  /** set up an axis-brush object to hold results. */
  ensureAxisBrush(block) {
    let store = this.get('store'),
    typeName = 'axis-brush',
    axisBrushId = block.id,
    r = store.peekRecord(typeName, axisBrushId);
    if (r)
      console.log('ensureBlock', block.id, r._internalModel.__attributes, r._internalModel.__data);
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
      let result = block.get('featuresResult');
      if (result) {
        features = Promise.resolve(result);
      }
      else
        features = this.requestBlockFeaturesInterval(blockId);
      console.log(fnName, blockId, features);
    }
    return features;
  },


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
    let intervalParams = this.intervals([blockA]);
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
            dataBlockIds, undefined, domainCalc, axisEvents,
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
