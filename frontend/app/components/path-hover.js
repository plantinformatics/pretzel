import Ember from 'ember';

export default Ember.Component.extend({

  didInsertElement() {
    console.log("components/path-hover didInsertElement()", this);
    Ember.run.later(function() {
      let d = Ember.$('.tooltip.ember-popover');  // make-ui-draggable
      console.log(d);
      d.draggable(); });
  }
});
