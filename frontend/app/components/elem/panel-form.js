import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
  // attributes
  // classes
  classNameBindings: ['panelClass'],
  panelClass: computed('name', function() {
    return 'panel panel-' + this.name
  }),
  // actions
});
