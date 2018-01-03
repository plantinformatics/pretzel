import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  // attributes
  // classes
  classNameBindings: ['panelClass'],
  panelClass: Ember.computed('state', function() {
    return 'panel panel-' + this.state
  }),
  // actions
});
