import Component from '@ember/component';

export default Component.extend({
  tagName: 'li',
  // attributes
  attributeBindings: ['role:role'],
  role: 'separator',
  // classes
  classNames: ['divider'],
  // actions
});
