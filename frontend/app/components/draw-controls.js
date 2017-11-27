import Ember from 'ember';

export default Ember.Component.extend({

  didInsertElement() {
    console.log("components/draw-controls didInsertElement()", this.drawActions);
    this.drawActions.trigger("drawControlsLife", true);
  },
  willDestroyElement() {
    console.log("components/draw-controls willDestroyElement()");
    this.drawActions.trigger("drawControlsLife", false);
  },


});
