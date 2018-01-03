import Ember from 'ember';

import IconConditional from './icon-conditional';

export default IconConditional.extend({
  iconFalse: 'pencil',
  isVisible: Ember.computed('state', function() {
    let state = this.get('state');
    if (state === true) { return false; }
    else { return true; }
  }),
});