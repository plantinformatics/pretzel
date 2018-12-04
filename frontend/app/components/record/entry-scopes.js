import Ember from 'ember';
import EntryBase from './entry-base';

export default EntryBase.extend({
  tagName: '',
  initSteps: function() {
    let layout = {
      'active': false
    }
    this.set('layout',layout);
  }.on('init'),
  expandIcon: Ember.computed('layout.active', function() {
    let active = this.get('layout.active')
    return active? 'minus' : 'plus'
  }),
  actions: {
    switch() {
      let active = this.get('layout.active')
      this.set('layout.active', !active)
    }
  }
});
