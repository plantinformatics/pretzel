import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
  tagName: 'button',
  // attributes
  click: function() {
    this.sendAction('onClick');
  },
  attributeBindings: ['disabled'],
  // classes
  classNames: ['btn'],
  classNameBindings: ['sizeClass', 'colourClass'],
  sizeClass: computed('classSize', function() {
    let prop = this.get('classSize')
    if (prop) {
      return 'btn-' + prop
    } else {
      return ''
    }
  }),
  colourClass: computed('classColour', function() {
    let prop = this.get('classColour')
    if (prop) {
      return 'btn-' + prop
    } else {
      return ''
    }
  }),
  // actions
});
