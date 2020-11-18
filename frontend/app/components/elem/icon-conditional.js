import { computed } from '@ember/object';

import IconBase from './icon-base';

/**
 * IconBase will use .name to add to the element's classes.
 */
export default IconBase.extend({
  /** By default, if a Component which extends this does not define iconTrue or
   * iconFalse then if state has the corresponding value, then iconClass will be
   * undefined.
   * This achieves the functionality which was implemented using isVisible() in
   * the original version of icon-{editable,owner,visible}.js
   */
  iconTrue: undefined, // 'exclamation-sign',
  iconFalse: undefined, // 'exclamation-sign',
  /** @return either iconTrue or iconFalse according to the value of .state (true / false)
   */
  name: computed('state', function() {
    let state = this.get('state');
    if (state === true) { return this.iconTrue; }
    else { return this.iconFalse; }
  }),
});
