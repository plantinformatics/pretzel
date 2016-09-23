import Ember from 'ember';

export default Ember.Component.extend({

  draw: function(myData) {
    // Draw functionality goes here.
    //
    console.log("data to draw:");
    console.log(myData);
  },

  didInsertElement() {
    console.log("draw map");
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
    var data = this.get('data');
    this.draw(data);
  }
});
