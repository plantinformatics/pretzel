import Ember from 'ember';

/* global d3 */

export default Ember.Component.extend({

  feed: Ember.inject.service(),

  colouredMarkers : undefined,

  actions : {
    putContent : function (component, event) {
      console.log("putContent", component, event);
	let markerNames = event.target.innerText;
      this.get('feed').trigger('colouredMarkers', markerNames);
    }
  },

  didRender() {
    let data = this.get('data');

    let grid = d3.divgrid();
    d3.select('#griddy')
      .datum(data)
      .call(grid);
     // console.log(data.length);

  },

  onSelectionChange: function () {
    let data = this.get('data');
    console.log("selected-markers.js", "onSelectionChange", data.length);
    let markerNamesText = data.map(function (d, i, g) { return d.Marker;}).join("\n");
    this.set('selection', markerNamesText);
  }.observes('data'),


});
