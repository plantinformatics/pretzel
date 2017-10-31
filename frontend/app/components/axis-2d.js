import Ember from 'ember';
import { eltWidthResizable } from '../utils/domElements';

/* global d3 */

export default Ember.Component.extend(Ember.Evented, {

  needs: ['component:tracks'],

  subComponents : [],

  actions: {
    addTracks : function()
    {
      if (false)
      {
        // works if axisArea is (string selector and) is not within an existing ember view
      const tracksComponent = Ember.getOwner(this).factoryFor('component:tracks');
      let axisArea = Ember.$('.foreignObject > body > #axis2D');
      console.log("components/axis-2d addTracks", axisArea, tracksComponent);
      let t = tracksComponent.create();
        t.appendTo(axisArea);
      }
      else
      {
        this.get('subComponents').pushObject('axis-tracks');
      }
    },
    addTable : function()
    {
        this.get('subComponents').pushObject('axis-table');
    },
    addChart : function()
    {
        this.get('subComponents').pushObject('axis-chart');
    },
    remove: function(){
      this.remove();
      console.log("components/axis-2d remove()");
    }
  },

  didRender() {
    let me = this;
    let prevSize,  currentSize;
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
      currentSize = width; // dx ?

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
      me.trigger('resized', prevSize, currentSize);
      prevSize = currentSize;
    }
    Ember.run.later( function () { 
      let dragResize = eltWidthResizable('.foreignObject', undefined, resized);	// #axis2D
      dragResize.on('end', resizeEnded);
    }, 1000);
  },

});

