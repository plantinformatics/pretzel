import { inject as service } from '@ember/service';
import Component from '@ember/component';

/* global d3 */

export default Component.extend({

  feed: service(),

  colouredFeatures : undefined,

  actions : {
    putContent : function (component, event) {
      console.log("putContent", component, event);
	let featureNames = event.target.innerText;
      this.get('feed').trigger('colouredFeatures', featureNames);
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
    console.log("selected-features.js", "onSelectionChange", data.length);
    let featureNamesText = data.map(function (d, i, g) { return d.Feature;}).join("\n");
    this.set('selection', featureNamesText);
  }.observes('data'),


});
