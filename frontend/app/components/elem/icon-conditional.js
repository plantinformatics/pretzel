import Ember from 'ember';

import IconBase from './icon-base';

export default IconBase.extend({
  iconTrue: 'exclamation-sign',
  iconFalse: 'exclamation-sign',
  name: Ember.computed('state', function() {
    let state = this.get('state');
    if (state === true) { return this.iconTrue; }
    else { return this.iconFalse; }
  }),
});
