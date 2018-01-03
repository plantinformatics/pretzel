import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  tagName: 'div',
  // attributes
  // classes
  classNameBindings: ['iconClass'],
  iconClass: Ember.computed('name', function() {
    return 'glyphicon glyphicon-' + this.name
  }),
  // actions
});
