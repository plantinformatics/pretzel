import Ember from 'ember';

/* global d3 */

export default Ember.Component.extend({

  resetGrid: function(markers) {
    d3.select('#grid')
      .datum(markers)
      .call(grid);
  },

  didInsertElement() {
    let data = this.get('data');
    console.log(data);
    let body = d3.select('body');
    body.append('textarea').node().value = "";

  },

  didRender() {
    let data = this.get('data');
    console.log(data);
    d3.select('textarea').node().value = data.length;

  }
    
});
