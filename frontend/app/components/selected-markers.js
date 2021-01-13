import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

/* global d3 */


export default Component.extend({

  feed: service(),

  colouredFeatures : undefined,

  actions : {
    flipRegion : function () {
	let
	    textDiv = d3.select('.colouredFeatures.ember-content-editable'),
	featureNames_ = textDiv.node().innerText,
	featureNames = 
	    (featureNames_.match(/\S+\r?\n|\S+\r?$/g) || [])
	    .map(function(c) { return c.trim('\n'); } );
	    // .match(/\S+/g) || [];
	console.log("flipRegion", "selected-features.js", featureNames_.length, featureNames.length);
      this.get('feed').trigger('flipRegion', featureNames);
    },

      clearScaffoldColours  : function () {
      console.log("clearScaffoldColours", "selected-features.js");
      this.get('feed').trigger('clearScaffoldColours');
      },

    resetZooms : function () {
      this.get('feed').trigger('resetZooms');
    },

    putContent : function (component, event) {
      console.log("putContent", component, event);
	let featureNames = event.target.innerText;
      this.get('feed').trigger('colouredFeatures', featureNames);
    }
  },
    
  resetGrid: function(features) {
    /** grid was undefined - is this function used ? */
    console.log("resetGrid");
    let grid = d3.divgrid();
    d3.select('#grid')
      .datum(features)
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

    onSelectionChange: observer('data', function () {
	let data = this.get('data');
	console.log("selected-features.js", "onSelectionChange", data.length);
	let featureNamesText = data.map(function (d, i, g) { return d.Feature;}).join("\n");
	this.set('selection', featureNamesText);
    }),


    /** From the model data, extract the feature name column, and return these as a newline-concatenated string,
     * for display in content-editable, passed as arg : {{content-editable  value=featureNames ... }}
     */
    featureNames: computed('data.[]', function(fnName) {
	let data = this.get('data');
	console.log("selected-features.js", fnName, data.length);
	let featureNamesText = data.map(function (d, i, g) { return d.Feature;}).join("\n");
	// this.set('colouredFeatures', featureNamesText);
	return featureNamesText;
    })


});
