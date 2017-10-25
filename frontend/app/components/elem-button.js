import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  tagName: 'span',
  // attributes
  click: function() {
    console.log('click fired! - ' + this.get('name'));
    this.sendAction('onClick');
  },
  // classes
  classNames: ['btn'],
  classNameBindings: ['sizeClass', 'colourClass'],
  sizeClass: Ember.computed('classSize', function() {
    let prop = this.get('classSize')
    if (prop) {
      return 'btn-' + prop
    } else {
      return ''
    }
  }),
  colourClass: Ember.computed('classColour', function() {
    let prop = this.get('classColour')
    if (prop) {
      return 'btn-' + prop
    } else {
      return ''
    }
  }),
  // actions
});
