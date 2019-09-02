import Ember from 'ember';
const { inject: { service } } = Ember;

import { eltWidthResizable } from '../utils/domElements';
import AxisEvents from '../utils/draw/axis-events';

/* global d3 */

const axisTransitionTime = 750;


export default Ember.Component.extend(Ember.Evented, AxisEvents, {
  blockService: service('data/block'),

  needs: ['component:tracks'],

  subComponents : undefined,

  targetEltId : Ember.computed('axisID', function() {
    let id = 'axis2D_' + this.axisID;
    console.log("targetEltId", this, id);
    return id;
  }),

  axis : Ember.computed('axisID', function() {
    let axisID = this.get('axisID');
    let stacks = this.get('drawMap.oa.stacks');
    let axis = stacks.axesP[axisID];
    return axis;
  }),
  axis1d : Ember.computed('axis', function() {
    let axis = this.get('axis'),
    axis1d = axis.axis1d;
    console.log('axis1d', axis1d);
    return axis1d;
  }),
  blocks : Ember.computed('axis', function() {
    let axis = this.get('axis');
    return axis && axis.blocks;
  }),
  /** @return just the ("child") data blocks, skipping the ("parent") reference
   * block which is block[0].
   */
  dataBlocks : Ember.computed('blocks', function () {
    let blocks = this.get('blocks'),
    /** use slice() to copy - don't modify blocks[]; and skip blocks[0]. */
    dataBlocks = blocks.slice(1);
    return dataBlocks;
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
    Ember.run.throttle(this, this.sendZoomed, [], 500);
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
    Ember.run.throttle(this, this.sendZoomed, axisID_t, 500);
  },


  /*--------------------------------------------------------------------------*/

  actions: {
    addTracks : function()
    {
      if (false)
      {
        // works if axisArea is (string selector and) is not within an existing ember view
      const tracksComponent = Ember.getOwner(this).factoryFor('component:tracks');
        // This selector should now be '... #axis2D_' + axisID
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
    },
    /**
     * @param componentName e.g. 'axis-tracks'
     */
    contentWidth : function (componentName, axisID, width) {
      this.contentWidth(componentName, axisID, width);
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
  childWidths : {},
  contentWidth : function (componentName, axisID, width) {
    let
      childWidths = this.get('childWidths'),
    previous = childWidths[componentName],
    deltaWidth = width - (previous || 0),
    startWidth = this.get('startWidth'),
    total = (startWidth || 0) + width,
    me = this,
    args = [total, deltaWidth]
    ;
    console.log('contentWidth', componentName, axisID, width, childWidths, previous, deltaWidth, startWidth, total);
     function call_setWidth() {
      childWidths[componentName] = width;
      me.setWidth.apply(me, args);
    }
    
    if (this.setWidth)
      call_setWidth();
    else
      Ember.run.later(call_setWidth);
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
      setWidth(width, dx);
    }
    function setWidth (width, dx) {
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
        delta = width - (startWidth || 0),
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
          .transition().duration(axisTransitionTime)
          .attr("transform", function(d) {return "translate(" + d + ",0)";});
        console.log('setWidth', use.node(), width, use.data(), use.attr('transform'), use.transition());
        if (rect.size() == 0)
          console.log('setWidth rect', rect.node(), axisUse.node(), use.node());
        else
        {
          rect.attr("width", width);
          console.log(rect.node(), rect.attr('width'));
        }
        /** Can use param d, same value as me.get('axisID').
         * axisID is also on the parent of <use> :
         * useElt = axisUse.node();
         * (useElt.length > 0) && (axisID = useElt[0].parentElement.__data__);
         */
        let
          axisID = me.get('axisID');
        let axis = me.get('axis');
        console.log('extended', axis.extended, width, axis);
        axis.extended = width;
        currentSize = width; // dx ?

        let parentView = me.get('parentView');
        /* Recalculate positions & translations of axes.
         * A possible optimisation : instead, add width change to the x translation of axes to the right of this one.
         */
        parentView.send('axisWidthResize', axisID, width, dx);
      }
      return ok;
    };
    this.set('setWidth', setWidth);
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
    function dragResizeListen () { 
      let axisID = me.get('axisID'),
      /** alternative : 'g.axis-outer#id' + axisID + ' .foreignObject' */
       axisSel = 'div#axis2D_' + axisID;
      let dragResize = eltWidthResizable(axisSel, undefined, resized);
      if (! dragResize)
        console.log('dragResizeListen', axisID, axisSel);
      else
      {
        dragResize.on('start', resizeStarted);
        dragResize.on('end', resizeEnded);
      }
    }
    Ember.run.later(dragResizeListen, 1000);
  },

});

