import Ember from 'ember';

export default Ember.Component.extend({
  tagName: '',

  initSteps: function() {
    let layout = {
      'active': false
    };
    this.set('layout',layout);
  }.on('init'),

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
