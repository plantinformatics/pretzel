import Ember from 'ember';

import Service from '@ember/service';
const { inject: { service } } = Ember;

import { stacks, Stacked } from '../../utils/stacks';

let axisApi;

let trace_pathsP = 2;

export default Service.extend({
  auth: service('auth'),
  store: service(),

  /** Paths returned from API, between adjacent blocks.
   * Initially just a single result for each blockID pair,
   * but will later hold results for sub-ranges of each block, at different resolutions.
   */
  paths : {},

  getPathsProgressive(blockAdj) {
    console.log('getPathsProgressive', blockAdj);
    let paths = this.get('paths')[blockAdj[0]];
    if (paths) {
      paths = paths[blockAdj[1]];
    }
    if (! paths)
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
    page = { thresholdFactor : 1.0 /* density*/ },
    params = {axes : intervals, page, /*nFeatures : 100,*/ nSamples : 20, dbPathFilter : true };
    return params;
  },
  /**
   * @return  promise yielding paths result
   */
  requestPathsProgressive(blockAdj) {
    let blockA = blockAdj[0], blockB = blockAdj[1];
    let store = this.get('store');
    if (! axisApi)
      axisApi = stacks.oa.axisApi;

    // based on link-path: request()
    let me = this;
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
              f.id = f._id;
              f.type = 'feature';
              let c = store.push({data : [f]});
              axisApi.storeFeature(f.name, c[0], f.blockId);
              if (trace_pathsP > 2)
                console.log(c[0].get('id'), c[0]._internalModel.__data);
            }
          }
          let result = {
            type : 'blockAdj',
            block0 : blockAdj[0],
            block1 : blockAdj[1],
            pathsResult : res
          };
          let c = store.push({data : [result]});
          if (trace_pathsP > 2)
            console.log(c[0].get('block0'), c[0]._internalModel.__data);
        },
        function(err, status) {
          console.log('path request', blockA, blockB, me, err.responseJSON[status] /* .error.message*/, status);
        });
    return promise;
  }

});
