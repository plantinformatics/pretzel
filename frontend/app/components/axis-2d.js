import Ember from 'ember';
import { eltWidthResizable } from '../utils/domElements';
import AxisEvents from '../utils/draw/axis-events';

/* global d3 */

export default Ember.Component.extend(Ember.Evented, AxisEvents, {

  needs: ['component:tracks'],

  subComponents : undefined,

  targetEltId : Ember.computed('axisID', function() {
    let id = 'axis2D_' + this.axisID;
    console.log("targetEltId", this, id);
    return id;
  }),

  blocks : Ember.computed('axisID', function() {
    let axisID = this.get('axisID');
    let stacks = this.get('drawMap.oa.stacks');
    let axis = stacks.axesP[axisID];
    return axis.blocks;
  }),

  /*--------------------------------------------------------------------------*/

  feed: Ember.inject.service(),

  listenFeed: function() {
    let f = this.get('feed'); 
    console.log("listen", f);
    if (f === undefined)
      console.log('feed service not injected');
    else {
    }
  }.on('init'),

  // remove the binding created in listen() above, upon component destruction
  cleanupFeed: function() {
    let f = this.get('feed');
    if (f)
    {
    }

  }.on('willDestroyElement'),

  /** axis-2d receives axisStackChanged from draw-map and propagates it as zoomed to its children.
   * axisStackChanged() also sends zoomed, so debounce.
   */
  axisStackChanged : function() {
    console.log("axisStackChanged in components/axis-2d");
    Ember.run.debounce(this, this.sendZoomed, [], 500);
  },

  /** @param [axisID, t] */
  sendZoomed : function(axisID_t)
  {
    console.log("sendZoomed", axisID_t);
    this.trigger("zoomed", axisID_t);
  },

  /** @param [axisID, t] */
  zoomedAxis : function(axisID_t) {
    console.log("zoomedAxis in components/axis-2d", axisID_t);
    Ember.run.debounce(this, this.sendZoomed, axisID_t, 500);
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
        console.log("addTracks", this.get('axisID'), this.get('subComponents'));
      }
    },
    addTable : function()
    {
        this.get('subComponents').pushObject('axis-table');
      console.log("addTable", this.get('axisID'), this.get('subComponents'));
    },
    addChart : function()
    {
        this.get('subComponents').pushObject('axis-chart');
      console.log("addChart", this.get('axisID'), this.get('subComponents'));
    },
    addLd : function()
    {
      this.get('subComponents').pushObject('axis-ld');
      console.log("addLd", this.get('axisID'), this.get('subComponents'));
    },
    remove: function(){
      this.remove();
      console.log("components/axis-2d remove()");
    }
  },

  rectWidth() {
    let
      axisUse = this.get('axisUse'),
    rect2 = axisUse.select("g.axis-use > rect"),
    width = rect2.attr('width');
    console.log("rectWidth", this.get('startWidth'), this.currentWidth(), rect2.node(), width);
    return width;
  },
  currentWidth() {
    let use, use_data, currentWidth;
    (use = this.get('use'))
      && (use_data = use.data())
      && (currentWidth = use_data[0]);
    return currentWidth;
  },

  didInsertElement() {
    let oa = this.get('data'),
    axisUse = oa.svgContainer.selectAll("g.axis-outer#id"+this.get('axisID')),
    use = axisUse.selectAll("use");
    this.set('axisUse', axisUse);
    this.set('use', use);
    console.log("axis-2d didInsertElement", this, this.get('axisID'), axisUse.node(), use.node());
    this.set('subComponents', []);
  },

  didRender() {
    let me = this;
    let prevSize,  currentSize;
    let stacks = this.get('data').stacks;
    /** Called when resizer element for split axis resize is dragged.
     * @param d data of the resizer elt, which is axisID of the axis being resized
     */
    function resized(width, dx, eltSelector, resizable, resizer,  resizerElt, d)
    {
      console.log("resized", width, dx, eltSelector, resizable.node(), resizer.node(),  resizerElt, d);
      // constructed in axisShowExtend()
      // narrow to : g.axis-outer#id<axisID> > g.axis-use
      let 
        axisUse = me.get('axisUse'),
      rect = axisUse.select("g.axis-use > rect"),
      /** based on axisID. */
      use = me.get('use');
      /** initially data of use is axisID (d), until .data([width]) below */
      let
        startWidth = me.get('startWidth');
      let
        delta = width - startWidth,
      ok = delta < stacks.axisXRangeMargin;
      console.log(startWidth, width, delta, "axisXRangeMargin", stacks.axisXRangeMargin, ok);
      /* if !ok, maybe some animation to indicate the limit is reached,
       * or can probably apply the above check as a filter :
       * defaultFilter = dragResize.filter();  dragResize.filter(function () { defaultFilter(...) && ... ok; } );
       */
      if (ok)
      {
        use
          .data([width])
          .attr("transform", function(d) {return "translate(" + d + ",0)";});
        rect.attr("width", width);
        /** Can use param d, same value as me.get('axisID').
         * axisID is also on the parent of <use> :
         * useElt = axisUse.node();
         * (useElt.length > 0) && (axisID = useElt[0].parentElement.__data__);
         */
        let
          axisID = me.get('axisID');
        currentSize = width; // dx ?

        let parentView = me.get('parentView');
        /* Recalculate positions & translations of axes.
         * A possible optimisation : instead, add width change to the x translation of axes to the right of this one.
         */
        parentView.send('axisWidthResize', axisID, width, dx);
      }
      return ok;
    };
    function resizeStarted()
    {
      me.set('startWidth', me.rectWidth());
    }
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
      dragResize.on('start', resizeStarted);
      dragResize.on('end', resizeEnded);
    }, 1000);
  },

});

