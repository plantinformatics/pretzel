import Ember from 'ember';

import { elt0 } from '../../utils/ember-devel';

const trace_entryExpander = 1;

/*----------------------------------------------------------------------------*/


/**
 * @param nodeName  text to display in the expandable node
 * @param hoverText hover text
 */
export default Ember.Component.extend({
  tagName: '',

  active: false,

  entryTab : Ember.computed(function () {
    /** the parent entry-tab will be passed in as an argument; improvising to
     * trial the setLayoutActive feature. */
    let parent = this.parentView;
    while (parent && (parent._debugContainerKey !== "component:record/entry-tab"))
    {
      parent = parent.parentView;
    }
    return parent;
  }),
  allActive : Ember.computed('entryTab', 'entryTab.allActive', function () {
    let allActive = this.get('entryTab.allActive');
    // side effect : when allActive changes, it sets active.
    // compare !a !== !b, because (false !== undefined).
    if (! this.get('active') !== ! allActive) {
      if (trace_entryExpander > 1)
        console.log('allActive setting', this.get('active'), allActive,
                    elt0(this.elementId || this.parentView.elementId));
      Ember.run.scheduleOnce('afterRender', this, 'toggleActive');
    }
    if (trace_entryExpander > 1)
      console.log('allActive', allActive, elt0(this.elementId || this.parentView.elementId));
    return allActive;
  }),
  toggleActive : function () {
    this.toggleProperty('active');
  },
  combinedActive : Ember.computed('active', 'allActive', function () {
    let active = this.get('active');
    let allActive = this.get('allActive');
    if (trace_entryExpander > 1)
      console.log('combinedActive', active, allActive, elt0(this.elementId || this.parentView.elementId));
    return active;
  }),
  /** initTabActionBus(), termTabActionBus() are replaced by allActive(), combinedActive(). */
  initTabActionBus : function() {
    let parent = this.get('entryTab');
    if (parent && ! this.get('tabActionBus')) {
      if (trace_entryExpander > 2)
        // parent is entry-tab so use id not .elementId
        console.log('tabActionBus', parent, elt0(parent.get('id')),
                    elt0(this.parentView.elementId));
      this.set('tabActionBus', parent);
      let me = this;
      parent.on('setLayoutActive', setLayoutActive);
      function setLayoutActive (active) {
        let id = me.elementId || me.parentView.elementId;
        console.log('setLayoutActive', active, me.get('active'),
                    elt0(id));
        if (me.get('active') !== active) {
          let id = me.elementId || me.parentView.elementId;
          console.log('setLayoutActive', active, me.get('active'), me,
                      elt0(id));
          me.toggleProperty('active');
        }
      }
    }
  }, // .on('willRender'),
  termTabActionBus : function() {
    let parent = this.get('tabActionBus');
    if (parent)
      parent.off('setLayoutActive');
  },
  willDestroyElement() {
    // this.termTabActionBus();
  }

  /** expandIcon() and actions: switch() are replaced by using icon-toggle, with
   * .active bound.
   */


});
