import Ember from 'ember';

import IconBase from './icon-base';

/** These components which predate this one may be able to use this component :
 *   icon-conditional.js
 *   icon-editable.js
 *   icon-owner.js
 *   icon-visible.js
 */

/**
* @param state  boolean value which is toggled by clicking the component
* @param iconTrue name of icon to show when value is true
* @param iconFalse   name of icon to show when value is false
*/
export default IconBase.extend({

  click(event) {
    // console.log('click', event, this.get('state'));
    this.toggleProperty('state');
    this.sendAction('changed', this.get('state'));
  },

  /** name is used by icon-base to construct the icon name.
   * The name is the part after 'glyphicon-'
   */
  name: Ember.computed('state', function() {
    let state = this.get('state'),
    name = state ? this.iconTrue : this.iconFalse;
    // console.log('name', state, name);
    return name;
  })

});
