import Ember from 'ember';
import { eltWidthResizable } from '../utils/domElements';

/* global d3 */

export default Ember.Component.extend({

  actions: {
    selectionChanged: function(selA) {
      console.log("selectionChanged in components/axis-2d", selA);
      for (let i=0; i<selA.length; i++)
        console.log(selA[i].marker, selA[i].position);
    },

  },

  didRender() {
    let me = this;
    function resized(width, dx, eltSelector, resizable, resizer,  resizerElt)
    {
      console.log("resized", width, dx, eltSelector, resizable.node(), resizer.node(),  resizerElt);
      // constructed in apShowExtend()
      // narrow to : g.ap#id<APid> > g.axis-use
      let use=d3.select("g.axis-use > use"),
      rect = d3.select("g.axis-use > rect");
      use
        .data([width])
        .attr("transform", function(d) {return "translate(" + d + ",0)";});
      rect.attr("width", width);
      let useElt = Ember.$(".axis-use"), apID;
      (useElt.length > 0) && (apID = useElt[0].parentElement.__data__);

      let parentView = me.get('parentView');
      /* Recalculate positions & translations of axes.
       * A possible optimisation : instead, add width change to the x translation of axes to the right of this one.
       */
      parentView.send('axisWidthResize', apID, width, dx);
    };
    function resizeEnded()
    {
      let parentView = me.get('parentView');
      console.log("resizeEnded");
      parentView.send('axisWidthResizeEnded');
    }
    Ember.run.later( function () { 
      let dragResize = eltWidthResizable('.foreignObject', undefined, resized);	// #axis2D
      dragResize.on('end', resizeEnded);
    }, 1000);
  },

});

