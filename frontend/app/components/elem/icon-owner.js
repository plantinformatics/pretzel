import { computed } from '@ember/object';

import IconConditional from './icon-conditional';

export default IconConditional.extend({
  iconTrue: 'user',
  isVisible: computed('state', function() {
    let state = this.get('state');
    if (state === true) { return true; }
    else { return false; }
  }),
});
