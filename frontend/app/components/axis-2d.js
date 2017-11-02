import Ember from 'ember';
import { eltWidthResizable } from '../utils/domElements';

/* global d3 */

export default Ember.Component.extend(Ember.Evented, {

  needs: ['component:tracks'],

  subComponents : [],

  /*--------------------------------------------------------------------------*/

  feed: Ember.inject.service(),

  listen: function() {
    let f = this.get('feed'); 
    console.log("listen", f);
    if (f === undefined)
      console.log('feed service not injected');
    else {
    }

    /** handle of the draw-map oa */
    let drawMap = this.get('drawMap'); 
    console.log("listen", drawMap);
    if (drawMap === undefined)
      console.log('parent component drawMap not passed');
    else {
      drawMap.on('axisStackChanged', this, 'axisStackChanged');
      drawMap.on('zoomedAxis', this, 'zoomedAxis');
    }
  }.on('init'),

  // remove the binding created in listen() above, upon component destruction
  cleanup: function() {
    let f = this.get('feed');
    if (f)
    {
    }

    let drawMap = this.get('drawMap');
    if (drawMap)
    drawMap.off('axisStackChanged', this, 'axisStackChanged');
    drawMap.off('zoomedAxis', this, 'zoomedAxis');
  }.on('willDestroyElement'),

  /** axis-2d receives axisStackChanged from draw-map and propagates it as zoomed to its children.
   * axisStackChanged() also sends zoomed, so debounce.
   */
  axisStackChanged : function() {
    console.log("axisStackChanged in components/axis-2d");
    Ember.run.debounce(this, this.sendZoomed, [], 500);
  },

  /** @param [apID, t] */
  sendZoomed : function(apID_t)
  {
    console.log("sendZoomed", apID_t);
    this.trigger("zoomed", apID_t);
  },

  /** @param [apID, t] */
  zoomedAxis : function(apID_t) {
    console.log("zoomedAxis in components/axis-2d", apID_t);
    Ember.run.debounce(this, this.sendZoomed, apID_t, 500);
  },


  /*--------------------------------------------------------------------------*/

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

