import Component from '@ember/component';

export default Component.extend({
  tagName: 'li',
  // attributes
  click: function() {
    this.onClick();
  },
  // classes
  // actions
});
