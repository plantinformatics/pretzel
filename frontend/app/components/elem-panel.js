import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  // attributes
  // classes
  classNameBindings: ['panelClass'],
  panelClass: Ember.computed('name', function() {
    return 'panel panel-' + this.name
  }),
  // actions
});
