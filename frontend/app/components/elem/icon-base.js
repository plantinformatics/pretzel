import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
  tagName: 'span',
  // attributes
  // classes
  classNameBindings: ['iconClass'],
  iconClass: computed('name', function() {
    let name = this.get('name')
    return 'glyphicon glyphicon-' + name
  }),
  // actions
});
