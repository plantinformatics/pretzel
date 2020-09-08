import Ember from 'ember';
const { inject: { service } } = Ember;

import { eltWidthResizable } from '../utils/domElements';
import AxisEvents from '../utils/draw/axis-events';

/* global d3 */

const dLog = console.debug;

const axisTransitionTime = 750;


export default Ember.Component.extend(Ember.Evented, AxisEvents, {
  blockService: service('data/block'),
  queryParams: service('query-params'),

  needs: ['component:tracks'],

  urlOptions : Ember.computed.alias('queryParams.urlOptions'),

  subComponents : undefined,

  targetEltId : Ember.computed('axisID', function() {
    let id = 'axis2D_' + this.axisID;
    console.log("targetEltId", this, id);
    return id;
  }),

  /** Earlier versions had CP functions axis(), blocks(), dataBlocksS() based on
   * stacks.js data structure for axes and blocks; these were dropped after
   * version 1d6437a.
   */

  /** @return the list of data blocks of this axis. These are the Ember Data store
   * blocks, collated based on the ComputedProperty axesBlocks.
   *
   * @return [] if there are no blocks with data in the axis.
   */
  dataBlocks : Ember.computed(
    'axisID',  'blockService.dataBlocks.@each.{isViewed,hasFeatures}',
    'blockService.viewed.[]',
    function () {
      let
        /** related : blockService.axesBlocks, axis1d.dataBlocks */
        dataBlocksMap = this.get('blockService.dataBlocks'),
      id = this.get('axisID'),
      dataBlocks = (dataBlocksMap && dataBlocksMap.get(id)) || [];
      console.log('dataBlocksMap', id, dataBlocksMap, dataBlocks);
      return dataBlocks;
    }),

  /** @return blocks which are viewedChartable, and whose axis is this axis.
   */
  viewedChartable : Ember.computed('blockService.viewedChartable.[]', 'axisID',
    function () {
      let
      id = this.get('axisID'),
      viewedChartable = this.get('blockService.viewedChartable')
        .filter((b) => { let axis = b.get('axis'); return axis && axis.axisName === id; });
      console.log('viewedChartable', id, viewedChartable);
      return viewedChartable;
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
    }
  },

  dualAxis : Ember.computed.alias('urlOptions.dualAxis'),
  rectWidth() {
    let
      axisUse = this.get('axisUse'),
    dualAxis = this.get('dualAxis'),
    /** <rect> is present iff dualAxis.  Otherwise use the x translation of <path> */
    rect2 = axisUse.select("g.axis-use > rect"),
    path = axisUse.select('g.axis-use > path'),
    width;
    if (/*dualAxis*/ rect2.size()) {
      width = rect2.attr('width');
    } else {
      let transform = path.attr('transform'),
      match = transform && transform.match(/translate\(([0-9.]+),/);
      width = match && +match[1];
    }
    console.log("rectWidth", this.get('startWidth'), this.currentWidth(), rect2.node(), path.node(), width);
    return width;
  },
  currentWidth() {
    let use, use_data, currentWidth;
    (use = this.get('use'))
      && (use_data = use.data())
      && (currentWidth = use_data[0]);
    return currentWidth;
  },
  /** width of sub-components within this axis-2d.  Indexed by componentName.
   * For each sub-component, [min, max] : the minimum required width, and the
   * maximum useful width, i.e. the maximum width that the component can fill
   * with content.
   * Measured nominally in pixels, but space may be allocated proportional to the width allocated to this axis-2d.
   */
  childWidths : undefined,
  /** Allocate the available width among the children listed in .childWidths
   * @return [horizontal start offset, width] for each child.
   * The key of the result is the same as the input .childWidths
   */
  allocatedWidths : Ember.computed('childWidths.{chart,tracks}.1', 'width', 'adjustedWidth', function () {
    // if @each were supported for hashes, would depend on : 'childWidths.@each.1', 
    let allocatedWidths,
    childWidths = this.get('childWidths'),
    groupNames = Object.keys(childWidths),
    requested = 
      groupNames.reduce((result, groupName) => {
        let cw = childWidths[groupName];
        result[0] += cw[0]; // min
        result[1] += cw[1]; // max
        return result;
      }, [0, 0]);
    /** Calculate the spare width after each child is assigned its requested
     * minimum width, and apportion the spare width among them.
     * If spare < 0 then each child will get < min, but not <0.
     */
    let
    startWidth = this.get('startWidth'),
    width = this.get('width'),
    // width || (this.get('axisUse') && this.rectWidth())
    available = this.get('adjustedWidth') || startWidth || 60,
    /** spare and share may be -ve */
    spare = available - (requested ? requested[0] : 0),
    share = 0;
    if (spare < 0)
      spare = 0;
    if (groupNames.length > 0) {
      share = spare / groupNames.length;
    }
    /** horizontal offset to the start (left) of the child. */
    let offset = 0;
    allocatedWidths = groupNames.reduce((result, groupName) => {
      let w = childWidths[groupName][0] + share;
      if (w < 0)
        w = 0;
      let allocated = [offset, w];
      offset += w;
      result[groupName] = allocated;
      return result;
    }, {});
    Ember.run.next(() => this.set('allocatedWidthsMax', offset));
    dLog('allocatedWidths', allocatedWidths, childWidths, width, available, offset);
    return allocatedWidths;
  }),
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

  init() {
    this._super(...arguments);
    this.set('axis1d.axis2d', this);
    this.set('childWidths', Ember.Object.create());
  },

  willDestroyElement() {
    if (this.get('axis1d')) {
      // expect that axis1d.axis2d === this or undefined.
      if (this.get('axis1d.axis2d') !== this) {
        dLog('willDestroyElement', this.get('axis1d'), 'references', this.get('axis1d.axis2d'));
      } else {
        this.set('axis1d.axis2d', undefined);
      }
    }

    this._super(...arguments);
  },

  /*--------------------------------------------------------------------------*/

  resizeEffect : Ember.computed.alias('drawMap.resizeEffect'),

  /*--------------------------------------------------------------------------*/

  didInsertElement() {
    this._super(...arguments);

    this.getUse();
  },
  getUse(backoffTime) {
    let oa = this.get('data'),
    axisUse = oa.svgContainer.selectAll("g.axis-outer#id"+this.get('axisID')),
    /** <use> is present iff dualAxis */
    use = axisUse.selectAll("use");
    if (axisUse.empty()) {
      dLog('getUse', backoffTime);
      Ember.run.later(() => this.getUse(backoffTime ? backoffTime * 2 : 1000));
    } else {
      this.set('axisUse', axisUse);
      this.set('use', use);
      console.log("axis-2d didInsertElement", this, this.get('axisID'), axisUse.node(), use.node());
      this.set('subComponents', []);
    }
  },

  /** receive notification of draw-map resize. */
  resized : function(prevSize, currentSize) {
    dLog("resized in components/axis-2d", this, prevSize, currentSize);
  },

  /** Position the right edge path (if !dualAxis) for the current width
   * This is part of axisShowExtend(), which will be moved here;
   * this is the key part which needs to update.
   */
  positionRightEdgeEffect : Ember.computed('allocatedWidthsMax', 'allocatedWidths', function () {
    let axisUse;
    if (! this.get('dualAxis') && (axisUse = this.get('axisUse'))) {
      let
      shiftRight=5,
      /** allocatedWidths also calculates allocatedWidthsMax. */
      allocatedWidths = this.get('allocatedWidths'),
      width = this.get('allocatedWidthsMax');
      if (width !== undefined) {
        let
          p = axisUse.selectAll('g.axis-use > path')
        // .transition().duration(1000)
          .attr("transform",function(d) {return "translate(" + (width) + ",0)";});
        dLog('positionRightEdgeEffect', axisUse.node(), width, p.node());
      }
    }
  }),

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
      // if resizer is in <foreignObject> then resize the <foreignObject>
      if (resizerElt.classList[1] === 'inFO') {
      let at = resizable.node(),
        fo = at.parentElement.parentElement;
        dLog('resized', fo, at);
        fo.setAttribute('width', width);
      }
      setWidth(width, dx);
    }
    function setWidth (width, dx) {
      // constructed in axisShowExtend()
      // narrow to : g.axis-outer#id<axisID> > g.axis-use
      let 
        axisUse = me.get('axisUse'),
      dualAxis = me.get('dualAxis'),
      rectSel = 'g.axis-use ' + (dualAxis ? '' : '> clipPath ') + '> rect',
      rect = axisUse.select(rectSel),
      /** based on axisID. */
      use = me.get('use');
      /** initially data of use is axisID (d), until .data([width]) below */
      let
        startWidth = me.get('startWidth');
      let
        delta = width - (startWidth || 0),
      ok = Math.abs(delta) < stacks.axisXRangeMargin;
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
        if (! use.empty())  // use.data() is not valid if empty
          console.log('setWidth', use.node(), width, use.data(), use.attr('transform'), use.transition());
        if (rect.size() == 0)
          console.log('setWidth rect', rect.node(), axisUse.node(), use.node());
        else
        {
          rect.attr("width", width);
          console.log(rect.node(), rect.attr('width'));
        }
        let axisTitle = axisUse.selectAll('g > g.axis-all > text')
          .transition().duration(axisTransitionTime)
          // duplicated in utils/draw/axis.js : yAxisTitleTransform()
          .attr("transform", "translate(" + width/2 + ",0)");
        console.log('axisTitle', axisTitle);

        /** Can use param d, same value as me.get('axisID').
         * axisID is also on the parent of <use> :
         * useElt = axisUse.node();
         * (useElt.length > 0) && (axisID = useElt[0].parentElement.__data__);
         */
        let
          axisID = me.get('axisID');
        console.log('extended', me.get('axis1d.extended'), width);
        me.set('width', width);
        // When calculated .layoutWidth changes, take into account user adjustment to width.
        me.set('adjustedWidth', width);
        currentSize = width; // dx ?

        /** when parentView.send(axisWidthResize ) was added in 22a6af9,
         * draw-map was parentView of axis-2d;  now its parentView is axis-1d.
         * Will soon drop this connection. */
        let drawMap = me.get('drawMap');
        /* Recalculate positions & translations of axes.
         * A possible optimisation : instead, add width change to the x translation of axes to the right of this one.
         */
        drawMap.send('axisWidthResize', axisID, width, dx);
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
      let drawMap = me.get('drawMap');
      console.log("resizeEnded");
      drawMap.send('axisWidthResizeEnded');
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

