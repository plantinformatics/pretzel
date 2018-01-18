import Ember from 'ember';

import IconConditional from './icon-conditional';

export default IconConditional.extend({
  iconTrue: 'user',
  isVisible: Ember.computed('state', function() {
    let state = this.get('state');
    if (state === true) { return true; }
    else { return false; }
  }),
});
