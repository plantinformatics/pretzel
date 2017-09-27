import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  tagName: 'li',
  // attributes
  attributeBindings: ['role:role'],
  role: 'presentation',
  // classes
  classNameBindings: ['tabActive'],
  tabActive: Ember.computed('state', function() {
    if (this.key && this.state === this.key) return 'active'
    else return ''
  }),
  // actions
  actions: {
    onClick() {
      this.sendAction('onClick', this.side, this.key);
    }
  }
});
