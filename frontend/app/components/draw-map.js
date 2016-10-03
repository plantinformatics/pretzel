import Ember from 'ember';

export default Ember.Component.extend({

  draw: function(myData, myMaps) {
    // Draw functionality goes here.
    //
    console.log("maps to draw:");
    console.log(myMaps);
    console.log("data to draw:");
    console.log(myData);
  },

  didInsertElement() {
    // Only called after DOM element inserted for first time.
    //
    let svgContainer = d3.select('#holder').append('svg')
                        .attr('width',700)
                        .attr('height',700);
    svgContainer.append('circle')
                .attr('cx', 250)
                .attr('cy', 250)
                .attr('r', 100);

  },

  didRender() {
    // Called on re-render (eg: add another map) so should call
    // draw each time.
    //
    let data = this.get('data');
    let maps = d3.keys(data);
    this.draw(data, maps);
  }
});
