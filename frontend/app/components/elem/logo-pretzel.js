import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
  tagName: 'div',
  // attributes
  // classes
  classNameBindings: ['iconClass'],
  iconClass: computed('name', function() {
    return 'glyphicon glyphicon-' + this.name
  }),
  // actions
});
