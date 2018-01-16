import Ember from 'ember';

export default Ember.Component.extend({
  tagName: 'span',
  classNames: ['markerName', 'btn',  'btn-link'],

  didInsertElement() {
    console.log("components/marker-name didInsertElement()", this);
  }
});
