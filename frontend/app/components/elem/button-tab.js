import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({
  tagName: 'li',
  // attributes
  attributeBindings: ['role:role'],
  role: 'presentation',
  // classes
  classNameBindings: ['tabActive'],
  tabActive: computed('state', function() {
    if (this.key && this.state === this.key) return 'active'
    else return ''
  }),
  // actions
  actions: {
    onClick() {
      this.onClick(this.side, this.key);
    }
  }
});
