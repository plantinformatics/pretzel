import Ember from 'ember';

/* global d3 */


export default Ember.Component.extend({

  feed: Ember.inject.service(),

  colouredMarkers : undefined,

  actions : {
    flipRegion : function () {
	let
	    textDiv = d3.select('.colouredMarkers.ember-content-editable'),
	markerNames_ = textDiv.node().innerText,
	markerNames = 
	    (markerNames_.match(/\S+\r?\n|\S+\r?$/g) || [])
	    .map(function(c) { return c.trim('\n'); } );
	    // .match(/\S+/g) || [];
	console.log("flipRegion", "selected-markers.js", markerNames_.length, markerNames.length);
      this.get('feed').trigger('flipRegion', markerNames);
    },

      clearScaffoldColours  : function () {
      console.log("clearScaffoldColours", "selected-markers.js");
      this.get('feed').trigger('clearScaffoldColours');
      },

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

    onSelectionChange: function () {
	let data = this.get('data');
	console.log("selected-markers.js", "onSelectionChange", data.length);
	let markerNamesText = data.map(function (d, i, g) { return d.Marker;}).join("\n");
	this.set('selection', markerNamesText);
    }.observes('data'),


    /** From the model data, extract the marker name column, and return these as a newline-concatenated string,
     * for display in content-editable, passed as arg : {{content-editable  value=markerNames ... }}
     */
    markerNames: function(fnName) {
	let data = this.get('data');
	console.log("selected-markers.js", fnName, data.length);
	let markerNamesText = data.map(function (d, i, g) { return d.Marker;}).join("\n");
	// this.set('colouredMarkers', markerNamesText);
	return markerNamesText;
    }.property('data.[]')

    
});
