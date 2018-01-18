import Ember from 'ember';

const { Component, inject: { service } } = Ember;

export default Ember.Component.extend({
  store: service(),
  tagName: 'div',
  // attributes
  // classes
  classNames: ['col-xs-12'],
  // actions
  actions: {
    setTab(panelSide, panelName) {
      this.sendAction('setTab', panelSide, panelName);
    }
  }
});
