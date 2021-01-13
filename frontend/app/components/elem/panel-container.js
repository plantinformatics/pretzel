import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
  // attributes
  // classes
  classNameBindings: ['panelClass'],
  panelClass: computed('state', function() {
    return 'panel panel-' + this.state
  }),
  // actions
});
