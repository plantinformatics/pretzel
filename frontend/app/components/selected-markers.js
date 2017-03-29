import Ember from 'ember';

/* global d3 */

export default Ember.Component.extend({

  resetGrid: function(markers) {
    d3.select('#grid')
      .datum(markers)
      .call(grid);
  },

  didRender() {
    let data = this.get('data');
    let grid = d3.divgrid();
    d3.select('#grid')
      .datum(data)
      .call(grid);
    // console.log(data);
  }
    
});
