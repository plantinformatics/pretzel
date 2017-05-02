import Ember from 'ember';

/* global d3 */


export default Ember.Component.extend({

  feed: Ember.inject.service(),

  colouredMarkers : undefined,

  actions : {
    putContent : function (component, event) {
      console.log("putContent", component, event);
	let markerNames = event.target.innerText;
      // this.sendAction('updateColouredMarkers', markerNames);
      this.get('feed').trigger('colouredMarkers', { name: 'click', event: markerNames });

    }
  },
    

  resetGrid: function(markers) {
    d3.select('#grid')
      .datum(markers)
      .call(grid);
  },

  didInsertElement() {
    let data = this.get('data');
    console.log(data);
    let ta = d3.select('#colouredMarkers')
      .append('textarea');
    // expand to show all lines; can move this to css if this feature is retained.
  },

  didRender() {
    let data = this.get('data');

    let grid = d3.divgrid();
    d3.select('#grid')
      .datum(data)
      .call(grid);
    console.log(data);

    let ta = d3.select('#colouredMarkers > textarea');
    if (ta.node().value == "")
    {
      let markerNamesText = data.map(function (d, i, g) { return d.Marker;}).join("\n");
      ta.node().value = markerNamesText; // data.length;
      this.set('colouredMarkers', markerNamesText);
    }
  }
    
});
