import Ember from 'ember';

/* global d3 */

export default Ember.Component.extend({
  tagName: 'div',
  // attributes
  // classes
  classNames: ['col-xs-12'],

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
	    let textDiv = d3.select('.colouredMarkers.ember-content-editable');
      let markerNames_ = textDiv.node().innerText;
      let markerNames = (markerNames_.match(/\S+\r?\n|\S+\r?$/g) || []).map(function(c) {
        return c.trim('\n');
      } );
	    // .match(/\S+/g) || [];
	    console.log("flipRegion", "selected-markers.js", markerNames_.length, markerNames.length);
      this.get('feed').trigger('flipRegion', markerNames);
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
