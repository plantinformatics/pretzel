import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  tagName: 'li',
  // attributes
  click: function() {
    this.sendAction('onClick');
  },
  // classes
  // actions
});
