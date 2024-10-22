import { computed } from '@ember/object';

import IconBase from './icon-base';

/** These components which predate this one may be able to use this component :
 *   icon-conditional.js
 *   icon-editable.js
 *   icon-owner.js
 *   icon-visible.js
 */

/**
* @param state  boolean value which is toggled by clicking the component
* click() toggles .state and also toggles the value which is passed in because it is 2-way bound.
* e.g. {{#elem/icon-toggle state=userSettings.genotype.hideControls }}
* @param iconTrue name of icon to show when value is true
* @param iconFalse   name of icon to show when value is false
* @param changed optional. action to signal when state changes.
* Called as changed(state).
* example usage : entry-tab.hbs : {{#elem/icon-toggle ... changed=(action this.allActiveChanged)
*/
export default IconBase.extend({

  click(event) {
    // console.log('click', event, this.get('state'));
    this.toggleProperty('state');
    /** optional action to signal change of state
     * The param will be in .attrs until this is changed to a Glimmer
     * component, then it will be in .args
     */
    const changed = this.attrs?.changed || this.args?.changed;
    if (changed) {
      changed(this.get('state'));
    }
  },

  /** name is used by icon-base to construct the icon name.
   * The name is the part after 'glyphicon-'
   */
  name: computed('state', function() {
    let state = this.get('state'),
    name = state ? this.iconTrue : this.iconFalse;
    // console.log('name', state, name);
    return name;
  })

});
