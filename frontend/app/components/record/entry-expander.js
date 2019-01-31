import Ember from 'ember';

/**
 * @param nodeName  text to display in the expandable node
 */
export default Ember.Component.extend({
  tagName: '',

  layout : {
      'active': false
  },

  initTabActionBus : function() {
    /** the parent entry-tab will be passed in as an argument; improvising to
     * trial the setLayoutActive feature. */
    let parent = this.parentView;
    while (parent && (parent._debugContainerKey !== "component:record/entry-tab"))
    {
      parent = parent.parentView;
    }
    if (parent) {
      // parent is entry-tab so use id not .elementId
      console.log('tabActionBus', parent, Ember.$("#"+parent.get('id'))[0]);
      this.set('tabActionBus', parent);
      let me = this;
      parent.on('setLayoutActive', function (active) {
        let id = me.elementId || me.parentView.elementId;
        console.log('setLayoutActive', active, me.get('layout'), me,
                    Ember.$("#"+id)[0]);
        me.set('layout.active', active);
      });
    }
  }.on('didRender'),
  termTabActionBus : function() {
    let parent = this.get('tabActionBus');
    if (parent)
      parent.off('setLayoutActive');
  },
  willDestroyElement() {
    this.termTabActionBus();
  },

  /** The result is passed as icon parameter of button-base,
   * and thence as name to icon-base, used in iconClass(),
   * i.e. it is the identifying part of a glyphicon- name.
   */
  expandIcon: Ember.computed('layout.active', function() {
    let active = this.get('layout.active');
    return active? 'minus' : 'plus';
  }),

  actions: {
    switch() {
      let active = this.get('layout.active');
      this.set('layout.active', !active);
    }
  }   


});
