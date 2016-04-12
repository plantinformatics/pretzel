import Ember from 'ember';

export function pluralize(params) {
  const count = params[0];
  const singular = params[1];
  return count === 1 ? singular : Ember.String.pluralize(singular);
}

export default Ember.Helper.helper(pluralize);
