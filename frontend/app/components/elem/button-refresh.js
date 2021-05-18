import Component from '@ember/component';

export default Component.extend({
  tagName: 'span',
  // attributes
  click: function() {
    this.sendAction('onClick');
  },
  // classes
  classNames: ['pull-right']
  // actions
});
