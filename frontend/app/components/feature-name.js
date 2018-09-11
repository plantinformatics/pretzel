import Ember from 'ember';

export default Ember.Component.extend({
  tagName: 'span',
  classNames: ['featureName', 'btn',  'btn-link'],

  didInsertElement() {
    this._super(...arguments);
    console.log("components/feature-name didInsertElement()", this);
  }
});
