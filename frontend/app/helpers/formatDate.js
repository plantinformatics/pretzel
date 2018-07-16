import Ember from 'ember';

export function formatDate(date) {
  return date.toLocaleString();
}

export default Ember.Helper.helper(formatDate);