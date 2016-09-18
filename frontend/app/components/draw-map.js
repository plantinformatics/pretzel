import Ember from 'ember';

export default Ember.Component.extend({
  didInsertElement() {
    let svgContainer = d3.select('#holder').append('svg')
                        .attr('width',700)
                        .attr('height',700);
    svgContainer.append('circle')
                .attr('cx', 250)
                .attr('cy', 250)
                .attr('r', 100);

  },

  didRender() {
    console.log("didRender");
    var mydata = this.get('mydata');
    mydata.then(function(maplist) {
      maplist.forEach(function(m) {
        console.log(m.get('name'));
      });
    });
  }
});
