import Ember from 'ember';

export function toJson([obj]) {
  if (!obj) {
    return '';
  }
  return JSON.stringify(obj);
}

export default Ember.Helper.helper(toJson);