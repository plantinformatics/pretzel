import Ember from 'ember';
const { inject: { service } } = Ember;

import { eltWidthResizable } from '../utils/domElements';
import { eltIdGpRef }  from '../utils/draw/axis';
import AxisEvents from '../utils/draw/axis-events';
import { stacks, xScaleExtend  } from '../utils/stacks';

/* global d3 */

const dLog = console.debug;

const axisTransitionTime = 750;
/** 0 or 1 to disable or enable transitions */
const transitionEnable = 1;

/** width of track <rect>s */
let trackWidth = 10;




export default Ember.Component.extend(Ember.Evented, AxisEvents, {
  blockService: service('data/block'),
  queryParams: service('query-params'),

  needs: ['component:tracks'],

  urlOptions : Ember.computed.alias('queryParams.urlOptions'),

  subComponents : undefined,

  targetEltId : Ember.computed('axisID', function() {
    let id = 'axis2D_' + this.axisID;
    dLog("targetEltId", this, id);
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
    'axisID',
    /* Would like to depend on blockService.dataBlocks, and specifically on
     * blockService.dataBlocks[id], but blockService.dataBlocks is a Map not an array,
     * so depend on loadedViewedChildBlocks which dataBlocks depends on.
     */
    'blockService.loadedViewedChildBlocks.@each.{isViewed,hasFeatures,isZoomedOut}',
    'blockService.viewed.[]',
    function () {
      let
        /** related : blockService.axesBlocks, axis1d.dataBlocks */
        dataBlocksMap = this.get('blockService.dataBlocks'),
      id = this.get('axisID'),
      dataBlocks = (dataBlocksMap && dataBlocksMap.get(id)) || [];
      dataBlocks = dataBlocks.filter((block) => ! block.get('isZoomedOut'));
      dLog('dataBlocksMap', id, dataBlocksMap, dataBlocks);
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
      dLog('viewedChartable', id, viewedChartable);
      return viewedChartable;
  }),

  /*--------------------------------------------------------------------------*/

  feed: Ember.inject.service(),

  listenFeed: function() {
    let f = this.get('feed'); 
    dLog("listen", f);
    if (f === undefined)
      dLog('feed service not injected');
    else {
    }
  }.on('init'),

  /** axis-2d receives axisStackChanged from draw-map and propagates it as zoomed to its children.
   * axisStackChanged() also sends zoomed, so debounce.
   */
  axisStackChanged : function() {
    dLog("axisStackChanged in components/axis-2d");
    Ember.run.throttle(this, this.sendZoomed, [], 500);
  },

  /** @param [axisID, t] */
  sendZoomed : function(axisID_t)
  {
    dLog("sendZoomed", axisID_t);
    this.trigger("zoomed", axisID_t);
  },

  /** @param [axisID, t] */
  zoomedAxis : function(axisID_t) {
    dLog("zoomedAxis in components/axis-2d", axisID_t);
    Ember.run.throttle(this, this.sendZoomed, axisID_t, 500);
  },


  /*--------------------------------------------------------------------------*/

  actions: {
    addTracks : function()
    {
      this.get('subComponents').pushObject('axis-tracks');
      dLog("addTracks", this.get('axisID'), this.get('subComponents'));
    },
    addTable : function()
    {
        this.get('subComponents').pushObject('axis-table');
      dLog("addTable", this.get('axisID'), this.get('subComponents'));
    },
    addChart : function()
    {
        this.get('subComponents').pushObject('axis-chart');
      dLog("addChart", this.get('axisID'), this.get('subComponents'));
    },
    addLd : function()
    {
      this.get('subComponents').pushObject('axis-ld');
      dLog("addLd", this.get('axisID'), this.get('subComponents'));
    },
    remove: function(){
      this.remove();
      dLog("components/axis-2d remove()");
    },

    axisWidthResize : function(axisID, width, dx) {
      dLog("axisWidthResize in components/axis-2d", axisID, width, dx);
      let axisWidthResize = this.get('axisWidthResize');
      if (axisWidthResize) axisWidthResize(axisID, width, dx);
    },
    axisWidthResizeEnded : function() {
      dLog("axisWidthResizeEnded in components/axis-2d");
      let axisWidthResizeEnded = this.get('axisWidthResizeEnded');
      if (axisWidthResizeEnded) axisWidthResizeEnded();
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
    dLog("rectWidth", this.get('startWidth'), this.currentWidth(), rect2.node(), path.node(), width);
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
    groupNames = childWidths ? Object.keys(childWidths) : [],
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
    available = this.get('adjustedWidth') || startWidth || 2 * trackWidth,
    /** spare and share may be -ve */
    spare = available ? (available - (requested ? requested[0] : 0)) : 0,
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
    Ember.run.next(() => !this.isDestroying && this.set('allocatedWidthsMax', offset));
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
    dLog('contentWidth', componentName, axisID, width, childWidths, previous, deltaWidth, startWidth, total);
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

    let trackWidthOption = this.get('urlOptions.trackWidth');
    if (trackWidthOption) {
      trackWidth = trackWidthOption;
    }
  },

  willDestroyElement() {
    let extended = this.get('axis1d.extended');
    if (extended) {
      dLog('willDestroyElement .extended', extended, this.get('axisID'), this.get('axis1d'));
    }
    /* Expect here that .extended is false / 0, and this will cause show() to remove the rendered SVG elements.
     * including the right edge path (so no need for positionRightEdge() to remove it).
     */
    this.show();

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

  willRender() {
    dLog('axis-2d willRender', this.get('axisID'));
    this.show();
  },
  /** If .axis1d.extended, render the <g.axis-use> and sub-elements,
   * otherwise remove them.
   */
  show() {
    let     axisS = this.get('axis1d.axisS'),
    axisID = this.get('axisID');
    this.axisShowExtend(axisS, axisID, /*axisG*/ undefined);
  },

  didInsertElement() {
    this._super(...arguments);
    dLog('axis-2d didInsertElement', this.get('axisID'));

    this.getUse();
  },
  getUse(backoffTime) {
    let oa = this.get('data'),
    /** This is g.axis-outer, which contains g.axis-use.  */
    axisUse = oa.svgContainer.selectAll("g.axis-outer#id"+this.get('axisID')),
    /** <use> is present iff dualAxis */
    use = axisUse.selectAll("use");
    if (axisUse.empty()) {
      dLog('getUse', backoffTime);
      Ember.run.later(() => this.getUse(backoffTime ? backoffTime * 2 : 1000));
    } else {
      this.set('axisUse', axisUse);
      this.set('use', use);
      dLog("axis-2d didInsertElement", this, this.get('axisID'), axisUse.node(), use.node());
      this.set('subComponents', []);
    }
  },

  /** receive notification of draw-map resize. */
  resized : function(prevSize, currentSize) {
    dLog("resized in components/axis-2d", this, prevSize, currentSize);
  },

  /*--------------------------------------------------------------------------*/

  /** object attributes of the draw-map component; used as a provisional connector. */
  oa : Ember.computed.alias('data'),

  axisWidthResize(axisID, width, dx)
  {
    dLog("axisWidthResize", axisID, width, dx);
    // this is already done when called from setWidth()
    this.set('adjustedWidth', width);
    // axisWidthResizeRight(axisID, width, dx);
  },
  axisWidthResizeEnded()
  {
    dLog("axisWidthResizeEnded");

    this.updateXScale();
    stacks.changed = 0x10;
    let oa = this.get('oa');
    /* Number of stacks hasn't changed, but X position needs to be
     * recalculated, as would be required by a change in the number of stacks. */
    let t = oa.axisApi.stacksAdjust(true, undefined);
    if (! this.get('axis1d.extended')) {
      this.show();
    }
    // may trigger this differently, could be action.
    Ember.run.next(() => this.get('axis1d').showZoomResetButtonXPosn());
  },
  /** Update the X scale / horizontal layout of stacks
   * copied from draw-map; the x scale will likely move to stacks-view, and this will likely be dropped.
   */
  updateXScale()
  {
    let oa = this.get('oa');
    // xScale() uses stacks.keys().
    oa.xScaleExtend = xScaleExtend(); // or xScale();
  },

  getAxisExtendedWidth(axisID)
  {
    let oa = this.get('oa');
    let axis = oa.axes[axisID],
    /** duplicates the calculation in axis-tracks.js : layoutWidth() */
    blocks = axis && axis.blocks,
    /** could also use : axis.axis1d.get('dataBlocks.length');
     * subtract 1 for the reference block;  for a GM, map 0 -> 1 */
    dataBlocksN = (blocks && blocks.length - 1) || 1,
    trackBlocksWidth =
      /*40 +*/ dataBlocksN * /*2 * */ trackWidth /*+ 20 + 50*/,
    initialWidth = /*50*/ trackBlocksWidth,
    /** this is just the Max value, not [min,max] */
    allocatedWidth,
    width = axis ? 
      (allocatedWidth = axis.allocatedWidth()) ||
      ((axis.extended === true) ? initialWidth : axis.extended) :
    undefined;
    dLog('getAxisExtendedWidth', width, allocatedWidth, initialWidth, axis.extended);
    return width;
  },
  axisShowExtend(axis, axisID, axisG)
  {
    dLog('axisShowExtend', axis, axisID, axisG);
    /** x translation of right axis */
    let 
    /** value of .extended may be false, so || 0.  */
      initialWidth = /*50*/ this.getAxisExtendedWidth(axisID) || 0,
    axisData = axis.extended ? [axisID] : [];
    let oa = this.get('oa');
    if (axisG === undefined)
      axisG = oa.svgContainer.selectAll("g.axis-outer#id" + axisID);
    let ug = axisG.selectAll("g.axis-use")
      .data(axisData);
    let ugx = ug
      .exit()
      .transition().duration(transitionEnable * 500)
      .remove();
    ugx
      .selectAll("use")
      .attr("transform",function(d) {return "translate(0,0)";});
    ugx
      .selectAll("rect")
      .attr("width", 0);
    ugx
      .selectAll(".foreignObject")
      .attr("width", 0);
    let eg = ug
      .enter()
      .append("g")
      .attr("class", "axis-use");
    let em = ug.merge(eg);

    /** If dualAxis, use <use> to show 2 identical axes.
     * Otherwise show only the left axis, and on the right side a line like an
     * axis with no ticks, just the top & bottom tick lines, but reflected so
     * that they point right.
     */
    let dualAxis = this.get('dualAxis');
    let vc = this.get('oa.vc');
    if (dualAxis) {
      let eu = eg
      /* extra "xlink:" seems required currently to work, refn :  dsummersl -
       * https://stackoverflow.com/questions/10423933/how-do-i-define-an-svg-doc-under-defs-and-reuse-with-the-use-tag */
        .append("use").attr("xlink:xlink:href", eltIdGpRef);
      eu //.transition().duration(1000)
        .attr("transform", (d) => "translate(" + this.getAxisExtendedWidth(d) + ",0)");

      let er = eg
        .append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 0),
      rm = er.merge(em.selectAll('g.axis-use > rect'))
        .attr("height", vc.yRange);
      rm
        .transition().duration(transitionEnable * 1000)
        .attr("width", initialWidth);
    }
    else
    {
      /** based on showTickLocations() */
      const xOffset = 25, shiftRight=5;
      let 
        tickWidth = xOffset/5,
      edgeHeight = axis.yRange(),
      line = d3.line(),
      sLine = line([
        [+tickWidth, 0],
        [0, 0],
        [0, edgeHeight],
        [+tickWidth, edgeHeight]
      ]),
      ra = eg
        .append("path"),
      thisAxis2d = this,
      rm = ra.merge(em.selectAll('g.axis-use > path'))
        .transition().duration(transitionEnable * 1000)
        .attr("transform",function(d) {
          let eWidth = thisAxis2d.getAxisExtendedWidth(d);
          dLog('axis- path transform', eWidth, d, this);
               return "translate(" + (eWidth) + ",0)";})
        .attr("d", sLine);
    }

    // foreignObject is case sensitive - refn https://gist.github.com/mbostock/1424037
    let ef = eg
      .append("g")
      .attr("class", "axis-html")
      .append("foreignObject")
      .attr("class", "foreignObject")
    /*.attr("x", 0)
     .attr("y", 0) */
      .attr("width", initialWidth /*0*/)
    // leave 4px unused at the bottom so as not to block sensitivity of chartTypeToggle (axis-chart)
      .attr("height", vc.yRange-6);
    let eb = ef
      .append("xhtml:body")
      .attr("class", "axis-table");
    ef
      .transition().duration(transitionEnable * 1000)
      .attr("width", initialWidth);
    if (eb.node() !== null)	  // .style() uses .node()
      eb
      .append("div")
      .attr("id", "axis2D_" + axisID) // matches axis-2d:targetEltId()
      .style("border:1px green solid");

      let axis1d = this.get('axis1d');
      if (axis1d) {
	axis1d.showZoomResetButtonXPosn();
      }

    /** this clipPath is created in AxisCharts:frame(), id is axisClipId(). */
    let axisClipRect = em.selectAll("g.chart > clipPath > rect");
    axisClipRect
      .attr("width", initialWidth)
  },

  /*--------------------------------------------------------------------------*/


  /** Position the right edge path (if !dualAxis) for the current width
   * This is part of axisShowExtend(), which will be moved here;
   * this is the key part which needs to update.
   */
  positionRightEdgeEffect : Ember.computed('allocatedWidthsMax', 'allocatedWidths', function () {
    // this.positionRightEdge();
  }),
  positionRightEdge() {
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
          .transition().duration(transitionEnable * 1000)
          .attr("transform",function(d) {return "translate(" + (width) + ",0)";});
        dLog('positionRightEdgeEffect', axisUse.node(), width, p.node());
      }
    }
  },

  didRender() {
    let me = this;
    let prevSize,  currentSize;
    let stacks = this.get('data').stacks;
    dLog("components/axis-2d didRender()");

    Ember.run.later(() => this.dragResizeListen(), 1000);
  },

  /** Called when resizer element for split axis resize is dragged.
   * @param d data of the resizer elt, which is axisID of the axis being resized
   */
  resizedByDrag(width, dx, eltSelector, resizable, resizer,  resizerElt, d)
  {
    dLog("resizedByDrag", width, dx, eltSelector, resizable.node(), resizer.node(),  resizerElt, d);
    // if resizer is in <foreignObject> then resize the <foreignObject>
    if (resizerElt.classList[1] === 'inFO') {
      let at = resizable.node(),
          fo = at.parentElement.parentElement;
      dLog('resizedByDrag', fo, at);
      fo.setAttribute('width', width);
    }
    this.setWidth(width, dx);
  },
  setWidth (width, dx) {
    // constructed in axisShowExtend()
    // narrow to : g.axis-outer#id<axisID> > g.axis-use
    let 
    axisUse = this.get('axisUse'),
    dualAxis = this.get('dualAxis'),
    rectSel = 'g.axis-use ' + (dualAxis ? '' : '> clipPath ') + '> rect',
    rect = axisUse.select(rectSel),
    /** based on axisID. */
    use = this.get('use');
    /** initially data of use is axisID (d), until .data([width]) below */
    let
    startWidth = this.get('startWidth');
    let
    delta = width - (startWidth || 0),
    ok = Math.abs(delta) < stacks.axisXRangeMargin;
    dLog(startWidth, width, delta, "axisXRangeMargin", stacks.axisXRangeMargin, ok);
    /* if !ok, maybe some animation to indicate the limit is reached,
     * or can probably apply the above check as a filter :
     * defaultFilter = dragResize.filter();  dragResize.filter(function () { defaultFilter(...) && ... ok; } );
     */
    if (ok)
    {
      use
        .data([width])
        .transition().duration(transitionEnable * axisTransitionTime)
        .attr("transform", function(d) {return "translate(" + d + ",0)";});
      if (! use.empty())  // use.data() is not valid if empty
        dLog('setWidth', use.node(), width, use.data(), use.attr('transform'), use.transition());
      if (rect.size() == 0)
        dLog('setWidth rect', rect.node(), axisUse.node(), use.node());
      else
      {
        rect.attr("width", width);
        dLog(rect.node(), rect.attr('width'));
      }
      let axisTitle = axisUse.selectAll('g > g.axis-all > text')
          .transition().duration(transitionEnable * axisTransitionTime)
      // duplicated in utils/draw/axis.js : yAxisTitleTransform()
          .attr("transform", "translate(" + width/2 + ",0)");
      dLog('axisTitle', axisTitle);

      /** Can use param d, same value as this.get('axisID').
       * axisID is also on the parent of <use> :
       * useElt = axisUse.node();
       * (useElt.length > 0) && (axisID = useElt[0].parentElement.__data__);
       */
      let
      axisID = this.get('axisID');
      dLog('extended', this.get('axis1d.extended'), width);
      this.set('width', width);
      // When calculated .layoutWidth changes, take into account user adjustment to width.
      this.set('adjustedWidth', width);
      this.set('currentSize', width); // dx ?

      /* Recalculate positions & translations of axes.
       * A possible optimisation : instead, add width change to the x translation of axes to the right of this one.
       */
      this.axisWidthResize(axisID, width, dx);

      let axis1d = this.get('axis1d');
      if (axis1d) {
	axis1d.showZoomResetButtonXPosn();
      }
    }
    return ok;
  },

  resizeStarted()
  {
    this.set('startWidth', this.rectWidth());
  },
  resizeEnded()
  {
    dLog("resizeEnded");
    this.axisWidthResizeEnded();
    this.trigger('resized', this.get('prevSize'), this.get('currentSize'));
    this.set('prevSize', this.get('currentSize'));
  },
  dragResizeListen () { 
    let axisID = this.get('axisID'),
        /** alternative : 'g.axis-outer#id' + axisID + ' .foreignObject' */
        axisSel = 'div#axis2D_' + axisID;
    let dragResize = eltWidthResizable(axisSel, undefined, Ember.run.bind(this, this.resizedByDrag));
    if (! dragResize)
      dLog('dragResizeListen', axisID, axisSel);
    else
    {
      dragResize.on('start', Ember.run.bind(this, this.resizeStarted));
      dragResize.on('end', Ember.run.bind(this, this.resizeEnded));
    }
  },

  willDestroyElement() {
    this.set('allocatedWidthsMax', 0);
    this.positionRightEdge();
  }

});

