import { inject as service } from '@ember/service';

import Helper, { helper } from "@ember/component/helper";
// or Ember.Helper.helper

import {
  featureChrs,
  name2Map,
  chrMap,
  objectSet,
  mapsOfFeature
} from '../utils/feature-lookup';

export default Helper.extend({

  store: service('store'),

  compute(params) {
    let
      oa = params[0],
    featureName = params[1],
    store = this.get('store');
    let axes = mapsOfFeature(store, oa, featureName);
    return axes;
  }
});



/*----------------------------------------------------------------------------*/
