import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  tagName: 'span',
  // attributes
  // classes
  classNameBindings: ['iconClass'],
  iconClass: Ember.computed('name', function() {
    let name = this.get('name')
    return 'glyphicon glyphicon-' + name
  }),
  // actions
});
