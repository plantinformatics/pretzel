import Ember from 'ember';

import Service from '@ember/service';
const { inject: { service } } = Ember;

import { stacks, Stacked } from '../../utils/stacks';
import { storeFeature } from '../../utils/feature-lookup';
import { updateDomain } from '../../utils/stacksLayout';

let trace_pathsP = 2;

function verifyFeatureRecord(fr, f) {
  let frd = fr._internalModel.__data,
  same = 
    (fr.id === f._id) &&
    (frd.value[0] === f.value[0]) &&
    ((frd.value.length !== 1) || (frd.value[1] === f.value[1])) &&
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
    r = store.peekRecord('blockAdj', blockAdjId);
    if (r)
      console.log('ensureBlockAdj', blockAdjId, r._internalModel.__data);
    if (! r) {
      r = store.createRecord('blockAdj', {
        block0 : blockAdjId[0],
        block1 : blockAdjId[1],
        blockId0 : blockAdjId[0],
        blockId1 : blockAdjId[1]
      });
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
    let paths = this.get('store').peekRecord('block-adj', blockAdj[0]);
    if (paths) {
      let result = paths.get('pathsResult');
      paths = Promise.resolve(result);
    }
    else
      paths = this.requestPathsProgressive(blockAdj);
    console.log('getPathsProgressive', blockAdj, paths);
    return paths;
  },
  /** Determine the parameters for the paths request, - intervals and density.
   */
  intervals(blockAdj) {
    let intervals = blockAdj.map(function (blockId) {
      let axis = Stacked.getAxis(blockId);
      return axis.axisDimensions();
    }),
    page = { },
    /*nFeatures : 100,*/ 
    params = {axes : intervals, page,  dbPathFilter : true };
    [0, 1].map(function (axis) {
    if ((intervals[axis].domain[0] === 0) && (intervals[axis].domain[1] === 0))
      intervals[axis].domain = undefined;
    });

    let oa = stacks.oa;
    let sample = oa.drawOptions.pathControlActiveSample();
    if (sample) {
      params.nSamples = sample;
    }
    let densityFactor = oa.drawOptions.pathControlActiveDensity();
    if (densityFactor) {
      page.densityFactor = densityFactor;
      page.thresholdFactor = densityFactor; // retire the name .thresholdFactor
    }

    return params;
  },
  /**
   * @return  promise yielding paths result
   */
  requestPathsProgressive(blockAdj) {
    let blockA = blockAdj[0], blockB = blockAdj[1];
    let store = this.get('store');

    // based on link-path: request()
    let me = this;
    let flowsService = this.get('flowsService');
    let intervalParams = this.intervals(blockAdj);
    let promise = 
      this.get('auth').getPathsProgressive(blockA, blockB, intervalParams, /*options*/{});
    promise
      .then(
        function(res){
          if (trace_pathsP > 1)
            console.log('path request then', res.length);
          for (let i=0; i < res.length; i++) {
            for (let j=0; j < 2; j++) {
              let f = res[i].alignment[j].repeats.features[0];
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
            }
          }
          let result = {
            type : 'blockAdj',
            id : blockAdj,
            block0 : blockAdj[0],
            block1 : blockAdj[1],
            pathsResult : res
          };
          let n = store.normalize(result.type, result);
          let c = store.push(n);
          if (trace_pathsP > 2)
            console.log(n, c.get('block0'), c._internalModel.__data);
          // Ember.run.next(function () {
            let axisApi = stacks.oa.axisApi;
            let t = stacks.oa.svgContainer.transition().duration(750);
          [blockA, blockB].map(function (blockId) {
            let eventBus = stacks.oa.eventBus;
            let
              block = stacks.blocks[blockId];
            console.log(blockId, 'before domainCalc, block.z', block.z); let
            /** updateDomain() uses axis domainCalc() but that does not recalculate block domain. */
            blockDomain = block.domain = block.domainCalc(),
            axis = Stacked.getAxis(blockId),
            /** axis domainCalc() also does not re-read the block's domains if axis.domain is already defined. */
            axisDomain = axis.domain = axis.domainCalc(),
            oa = stacks.oa;
            console.log(blockId, 'blockDomain', blockDomain, axisDomain, block.z);
            updateDomain(oa.y, oa.ys, axis);

            let axisID = axis.axisName, p = axisID;
            eventBus.trigger("zoomedAxis", [axisID, t]);
            // true does pathUpdate(t);
            axisApi.axisScaleChanged(p, t, true);

          });
            axisApi.axisStackChanged(t);
          // });

        },
        function(err, status) {
          console.log('path request', blockA, blockB, me, err.responseJSON[status] /* .error.message*/, status);
        });
    return promise;
  }

});
