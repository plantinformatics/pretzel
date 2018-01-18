import Ember from 'ember';

const { Component } = Ember;

export default Component.extend({
  tagName: 'li',
  // attributes
  attributeBindings: ['role:role'],
  role: 'separator',
  // classes
  classNames: ['divider'],
  // actions
});
