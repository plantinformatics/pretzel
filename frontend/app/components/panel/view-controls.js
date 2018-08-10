import Ember from 'ember';

/* global d3 */

export default Ember.Component.extend({
  tagName: 'div',
  // attributes
  // classes

  feed: Ember.inject.service(),

  didInsertElement() {
    console.log("components/draw-controls didInsertElement()", this.drawActions);
    this.drawActions.trigger("drawControlsLife", true);
  },
  willDestroyElement() {
    console.log("components/draw-controls willDestroyElement()");
    this.drawActions.trigger("drawControlsLife", false);
  },

  actions : {
    flipRegion : function () {
      this.get('feed').trigger('flipRegion', undefined);
    },

    clearScaffoldColours  : function () {
      console.log("clearScaffoldColours", "selected-markers.js");
      this.get('feed').trigger('clearScaffoldColours');
    },

    resetZooms : function () {
      this.get('feed').trigger('resetZooms');
    },

  },

});
