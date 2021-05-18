import Component from '@ember/component';

export default Component.extend({
  tagName: 'li',
  // attributes
  click: function() {
    this.sendAction('onClick');
  },
  // classes
  // actions
});
