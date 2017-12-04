import Ember from 'ember';

import ElemIcon from './elem-icon';

export default ElemIcon.extend({
  name: Ember.computed('state', function() {
    let state = this.get('state');
    if (state === true) { return 'user'; }
    else { return 'home'; }
  }),
});
