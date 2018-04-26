import Ember from 'ember';

import { helper } from "@ember/component/helper";
// or Ember.Helper.helper

import { featureChrs,  name2Map,   chrMap, objectSet,  mapsOfFeature } from '../utils/feature-lookup';

import Helper from "@ember/component/helper";

export default Helper.extend({

  store: Ember.inject.service('store'),

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
