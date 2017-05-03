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
    

  resetGrid: function(markers) {
    d3.select('#grid')
      .datum(markers)
      .call(grid);
  },

  didInsertElement() {
  },

  didRender() {
    let data = this.get('data');

    let grid = d3.divgrid();
    d3.select('#grid')
      .datum(data)
      .call(grid);
     // console.log(data.length);

  },

    /** Copy the name column from the marker data to colouredMarkers, which is the value displayed in content-editable.
     */
    markerNames: function(a,b,c,d) {
	console.log("markerNames", a, b, c, d);
	let data = this.get('data');
	console.log(data.length);
	let markerNamesText = data.map(function (d, i, g) { return d.Marker;}).join("\n");
	// this.set('colouredMarkers', markerNamesText);
	return markerNamesText;
    }.property('data.[]')

    
});
