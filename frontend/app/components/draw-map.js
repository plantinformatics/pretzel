import Ember from 'ember';

export default Ember.Component.extend({

  draw: function(myData, myMaps) {
    // Draw functionality goes here.
    //
    console.log("maps to draw:");
    console.log(myMaps);
    console.log("data to draw:");
    console.log(myData);

    let svgContainer = d3.select("svg");
    svgContainer.selectAll('circle').remove();
    svgContainer.selectAll('circle')
                .data(myMaps)
                .enter()
                .append('circle')
                .attr('cx', 100)
                .attr('cy', function(d) { return 100+parseInt(d)*50;})
                .attr('r', function(d) { return parseInt(d)*10; });
  },

  didInsertElement() {
    // Only called after DOM element inserted for first time.
    //

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
