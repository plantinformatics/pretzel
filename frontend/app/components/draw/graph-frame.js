import Component from '@ember/component';
// import Mixin from '@ember/object/mixin';
import { on } from '@ember/object/evented';

//------------------------------------------------------------------------------
  
import {
  later,
  debounce,
  throttle
} from '@ember/runloop';

import { alias } from '@ember/object/computed';
import { computed, get, set as Ember_set, observer } from '@ember/object';

//------------------------------------------------------------------------------

import { task, timeout } from 'ember-concurrency';

import { isEqual } from 'lodash/lang';

import $ from 'jquery';

//------------------------------------------------------------------------------

import {
  eltWidthResizable,
  eltResizeToAvailableWidth,
} from '../../utils/domElements';

import { highlightFeature_drawFromParams } from './highlight-feature';

import {
  DragTransition,
} from '../../utils/stacks-drag';
import { DropTarget } from '../../utils/draw/drop-target';

import { Viewport } from '../../utils/draw/viewport';


import { stacksAxesDomVerify }  from '../../utils/draw/stacksAxes';
import {
  Stack,
  stacks, // provisional
} from '../../utils/stacks';
import {
  collateData,
} from '../../utils/draw/collate-paths';
import { AxisTitle } from '../../utils/draw/axisTitle';
import { PathDataUtils } from '../../utils/draw/path-data';
import { AxisBrushZoom } from '../../utils/draw/axisBrush';

import { showSynteny } from '../../utils/draw/synteny-blocks-draw';

import { compareFields } from '../../utils/Object_filter';

//------------------------------------------------------------------------------

/* global d3 */

//------------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

//------------------------------------------------------------------------------

/** compareFn param for compareFields */
function compareViewport(keyName, a, b) {
  let different;
  if (keyName === 'viewportWidth') {
    /** viewportWidth may cycle due to the rendering affecting the geometry (seen once, in Firefox). */
    different = ((a === undefined) !== (b === undefined)) || Math.abs(a - b) > 5;
  } else {
    different = a !== b;
  }
  return different;
}

//------------------------------------------------------------------------------

if (! $.popover && $.fn.popover) {
  dLog('graph-frame initialise $.popover from .fn');
  $.popover = $.fn.popover;
  $.button = $.fn.button;	// maybe not used.
  $.tab = $.fn.tab;
}

//------------------------------------------------------------------------------
/** used by renderForeground() */

function flowName(flow)
{
  return flow.name;
}
function flowHidden(flow)
{
  let hidden = ! flow.visible;
  return hidden;
}

//------------------------------------------------------------------------------

export default Component.extend({

// export default Mixin.create({

/* function GraphFrame(context) {

  const
  oa = context,
  me = oa.eventBus;
  

  const result = {
    setupViewport,
    render,

    // resizeThisWithTransition,
    // resizeThisWithoutTransition,

    setCssVariable,
    flowName,
    flowHidden,

    recordViewport,
    showResize,

    updateSelections,

    // updateSyntenyBlocksPosition,

    readLeftPanelShown,
    // drawEffect,

    readLeftPanelToggle,
    stacksWidthChanged,
    resize,
    // resizeDrawing,

  };
*/

  //----------------------------------------------------------------------------

  stacksView : alias('oa.axisApi.stacksView'),
  xOffsetsChangeCount : alias('oa.eventBus.xOffsetsChangeCount'),

  //----------------------------------------------------------------------------

  initGraphFrame : on('init', function() {
    this.oa.graphFrame = this;
    this.oa.showResize = this.showResize.bind(this);
  }),

  //----------------------------------------------------------------------------

  setupViewport() {
    const oa = this.oa;
    let vc = oa.vc || (oa.vc = new Viewport());
    if (vc.count < 2)
    {
      console.log(oa, vc);
      vc.count++;
      vc.calc(oa);
      if (vc.count > 1)
      {
        /** could use equalFields(). */
        const
        viewPort = vc.viewPort,
        widthChanged = viewPort.w != vc.viewPortPrev.w,
        heightChanged = viewPort.h != vc.viewPortPrev.h;
        // showResize() -> collateO() uses .o
        if (oa.svgContainer && oa.o)
          this.showResize(widthChanged, heightChanged);
      }
      stacks.vc = vc; //- perhaps create vc earlier and pass vc to stacks.init()
    }
  },

  //----------------------------------------------------------------------------

  /** Render the outer SVG elements in the DOM : <svg><g>
   */
  renderFrame() {
    const oa = this.oa;

    //--------------------------------------------------------------------------

    collateData();

    stacksAxesDomVerify(stacks, oa.svgContainer);

    oa.axisApi.collateO?.();
    const vc = oa.vc;
    vc.xDropOutDistance_update(oa);

    //--------------------------------------------------------------------------

    const
    // axisHeaderTextLen = vc.axisHeaderTextLen,
    margins = vc.margins,
    marginIndex = vc.marginIndex;

    //--------------------------------------------------------------------------

    let svgRoot;
    /** Diverting to the login component removes #holder and hence <svg>, so
     * check if oa.svgRoot refers to a DOM element which has been removed. */
    let newRender = ((svgRoot = oa.svgRoot) === undefined)
      ||  (oa.svgRoot.node().getRootNode() !== window.document);
    if (newRender)
    {
      if (oa.svgRoot)
        console.log('newRender old svgRoot', oa.svgRoot.node(), oa.svgContainer.node(), oa.foreground.node());
      
      // Use class in selector to avoid removing logo, which is SVG.
      d3.select("svg.FeatureMapViewer").remove();
      d3.select("div.d3-tip").remove();
    }
    let translateTransform = "translate(" + margins[marginIndex.left] + "," + margins[marginIndex.top] + ")";
    if (newRender)
    {
      let graphDim = oa.vc.graphDim;
      oa.svgRoot = 
        svgRoot = d3.select('#holder').append('svg')
        .attr("class", "FeatureMapViewer")
        .attr("viewBox", oa.vc.viewBox.bind(oa.vc))
        .attr("preserveAspectRatio", "none"/*"xMinYMin meet"*/)
        .attr('width', "100%" /*graphDim.w*/)
        .attr('height', graphDim.h /*"auto"*/);
      oa.svgContainer =
        svgRoot
        .append("svg:g")
        .attr("transform", translateTransform);

      stacks.dragTransition = new DragTransition(oa.svgContainer);

      console.log(oa.svgRoot.node(), '.on(resize', this.resize);

      let resizeThis =
        // this.resize.bind(oa);
        (transition) => {
          if (trace)
            dLog("resizeThis", transition);
          debounce(this, this.resize, [transition], 500);
        };
      /** d3 dispatch.on() does not take arguments, and similarly for eltWidthResizable() param resized. */
      function resizeThisWithTransition() { resizeThis(true); }
      function resizeThisWithoutTransition() { resizeThis(false); }

      // This detects window resize, caused by min-/max-imise/full-screen.
      if (true)
        d3.select(window)
        .on('resize', resizeThisWithTransition);
      else  // also works, can drop if further testing doesn't indicate one is better.
        $( window )
        .resize(function(e) {
          console.log("window resize", e);
          // see notes in domElements.js regarding  .resize() debounce
          debounce(resizeThisWithTransition, 300);
        });

      /* 2 callbacks on window resize, register in the (reverse) order that they
       * need to be called (reorganise this).
       * Revert .resizable flex-grow before Viewport().calc() so the latter gets the new size.  */
      eltWidthResizable('.resizable', undefined, resizeThisWithoutTransition);
    }

  },

  //----------------------------------------------------------------------------

  /** Set a CSS name:value pair on svgRoot.
   * Used to set --path-stroke-{opacity,width} and --axisWidth.
   */
  setCssVariable(name, value)
  {
    this.oa.svgRoot.style(name, value);
  },

  //----------------------------------------------------------------------------

  /** Render the SVG <g> .foreground element which contains the paths
   * <g> flows : {direct, U_alias, alias, progress : {direct, alias}}
   * block-adj-s create <g class="blockAdj block-adj"> in the <g> .progress.*
   */
  renderForeground() {
    const oa = this.oa;
    // if (oa.foreground && newRender), oa.foreground element has been removed from DOM; commented above.
    let newRender;
    if ((oa.foreground === undefined) ||
        (newRender = (oa.foreground.node().getRootNode() !== window.document)))
    {
      oa.foreground =
        oa.svgContainer.append("g") // foreground has as elements "paths" that correspond to features
        .attr("class", "foreground");
      let flowValues = d3.values(oa.flows),
      flowsg = oa.foreground.selectAll("g")
        .data(flowValues)
        .enter()
        .append("g")
        .attr("class", flowName)
        .classed("hidden", flowHidden)
        .each(function (flow, i, g) {
          /** separate attributes g and .gf, the latter for paths collated in frontend */
          flow.gf = d3.select(this);
          /* related : drawGroupContainer() and updateSelections_flowControls() */
          if (! flow.g) {
            flow.g = d3.select();
          }
        })
      ;
    }
  },

  //----------------------------------------------------------------------------

  /** Record the viewport Width and Height for use as dependencies of
   * @see resizeEffect()
   */
  recordViewport(w, h) {
    later(
      () => 
        ! this.isDestroying &&
    this.setProperties({
      viewportWidth : w,
      viewportHeight : h
    }));
  },

  /** Render the affect of resize on the drawing.
   * @param widthChanged   true if width changed
   * @param heightChanged   true if height changed
   * @param useTransition  undefined (default true), or false for no transition
   */
  showResize(widthChanged, heightChanged, useTransition)
  {
    const
    oa = this.oa,
    axisApi = oa.axisApi,
    vc = oa.vc;
    console.log('showResize', widthChanged, heightChanged, useTransition);
    console.log('showResize',   this.get('viewportWidth'), vc.viewPort.w, this.get('viewportHeight'), vc.viewPort.h);
    let viewPort = vc && vc.viewPort;
    if (viewPort)
      /* When visibility of side panels (left, right) is toggled, width of
       * those panels changes in a transition (uses flex in CSS), and hence
       * resize() -> showResize() are called repeatedly in close succession,
       * with slightly changing width.
       * Minimise the impact of this by using debounce, and .toFixed(), since
       * changes < 1 pixel aren't worth a re-render.
       */
      debounce(
        this,
        this.recordViewport,
        viewPort.w.toFixed(),
        viewPort.h.toFixed(),
        500);
    axisApi.updateXScale?.();
    axisApi.collateO();
    axisApi.stacksView.axesShowXOffsets();
    if (widthChanged || (oa.axisTitleLayout?.verticalTitle === undefined)) {
      const axisTitle = AxisTitle(oa);
      axisTitle.updateAxisTitleSize(undefined);
    }
    let 
      duration = useTransition || (useTransition === undefined) ? 750 : 0,
    t = oa.svgContainer.transition().duration(duration);
    let graphDim = vc.graphDim;
    oa.svgRoot
      .attr("viewBox", vc.viewBox.bind(vc))
      .attr('height', graphDim.h /*"auto"*/);

    // recalculate Y scales before pathUpdate().
    if (heightChanged)
      axisApi.stacksAdjustY(t);

    // for stacked axes, window height change affects the transform.
    if (widthChanged || heightChanged)
    {
      t.selectAll(".axis-outer").attr("transform", Stack.prototype.axisTransformO);
      // also xDropOutDistance_update (),  update DropTarget().size
      const pathDataUtils = PathDataUtils(oa);
      pathDataUtils.pathUpdate(t /*st*/);
    }

    if (heightChanged)
    {
      // let traceCount = 1;
      oa.svgContainer.selectAll('g.axis-all > g.brush > clipPath > rect')
        .each(function(d) {
          const
          a = d,
          ya = a.y,
          yaRange = ya.range();
          // dLog('axis-brush', this, this.getBBox(), yaRange);
          // see also brushClip().
          d3.select(this)
          // set 0 because getting y<0, probably from brushClip() - perhaps use [0, yRange] there.
            .attr("y", 0)
            .attr("height", yaRange[1]);
        });
      oa.svgContainer.selectAll('g.axis-all > g.brush > g[clip-path]')
        .each(function(d) {
          /** d is axis-1d */
          if (d.isDestroying) {
            return;
          }
          /* if (traceCount-->0) console.log(this, 'brush extent', oa.y[d].brush.extent()()); */
          const
          a = d,
          ya = a.y,
          b = ya.brush;
          // draw the brush overlay using the changed scale
          d3.select(this).call(b);
          /* if the user has created a selection on the brush, move it to a
           * new position based on the changed scale. */
          let axisBrushZoom = AxisBrushZoom(oa);
          axisBrushZoom.axisBrushShowSelection(d, this);
        });
        if (DropTarget.prototype.showResize) {
          DropTarget.prototype.showResize();
        }
    }
    later( () => {
      if (this.isDestroying) { return; }
      /* This does .trigger() within .later(), which seems marginally better than vice versa; it works either way.  (Planning to replace event:resize soon). */
      if (widthChanged || heightChanged) {
        const eventBus = this.oa.eventBus;
        try {
          /** draw-map sends 'resized' event to listening sub-components using trigger().
           * It does not listen to this event. */
          eventBus.trigger('resized', widthChanged, heightChanged, useTransition);
        } catch (exc) {
          console.log('showResize', 'resized', eventBus, widthChanged, heightChanged, useTransition, graphDim, /*brushedDomains,*/ exc.stack || exc);
        }
      }
      // axisShowExtendAll();
      showSynteny(oa.syntenyBlocks, undefined, oa); });
  },

  //----------------------------------------------------------------------------

  /** After chromosome is added, draw() will update elements, so
   * this function is used to update d3 selections :
   * svgRoot, svgContainer, foreground, flows[*].g
   */
  updateSelections() {
    const oa = this.oa;
    let svgRoot = oa.svgRoot, svgContainer = oa.svgContainer,
    foreground = oa.foreground;
    console.log(
      "svgRoot (._groups[0][0])", svgRoot._groups[0][0],
      ", svgContainer", svgContainer._groups[0][0],
      ", foreground", foreground._groups[0][0]);
    svgRoot = d3.select('#holder > svg');
    svgContainer = svgRoot.select('g');
    foreground = svgContainer.select('g.foreground');
    console.log(
      "svgRoot (._groups[0][0])", svgRoot._groups[0][0],
      ", svgContainer", svgContainer._groups[0][0],
      ", foreground", foreground._groups[0][0]);
    //- moved code to app/utils/draw/flow-controls.js: updateSelections_flowControls() (new function)
  },

  //----------------------------------------------------------------------------

  //----------------------------------------------------------------------------


  updateSyntenyBlocksPosition : task(function * () {
    dLog('updateSyntenyBlocksPosition', this.oa.syntenyBlocks.length);
    const axisApi = this.oa.axisApi;
    if (axisApi.showSynteny) {
      axisApi.showSynteny(this.oa.syntenyBlocks, undefined);
    }
    yield timeout(100);
  }).keepLatest(),

  //----------------------------------------------------------------------------

  // eltWidthResizable('.resizable');

  readLeftPanelShown() {
    later(() => {
      $('.left-panel-shown')
        .on('toggled', (event) => this.readLeftPanelToggle() );
      /** .draggable() is provided by jquery-ui. ember-cli-jquery-ui is not
       * updated, and .make-ui-draggable is not enabled for any elements
       * currently; As needed, can instead use
       * e.g. github.com/mharris717/ember-drag-drop for .tooltip.ember-popover.
       * $('.make-ui-draggable').draggable();  */
    });
  },

  //----------------------------------------------------------------------------

  drawEffect : computed('data.[]', 'resizeEffect', function () {
    throttle(() => {
      const drawMap = this.oa.eventBus;
      drawMap.draw(this.get('data'), 'didRender');
    }, 1500);

    highlightFeature_drawFromParams(this);
  }),
  resizeEffect : computed(
    /* viewportWidth and viewportHeight will change as a result of changes in
     * stacksWidthChanges.{left,right}, so these dependencies could be
     * consolidated (checking that the dependencies change after the element size
     * has changed).
     */
    'stacksWidthChanges.@each', 'viewportWidth', 'viewportHeight',
    function () {
      let
      stacksWidthChanges = this.get('stacksWidthChanges'),
      viewportWidth = this.get('viewportWidth'),
      viewportHeight = this.get('viewportHeight'),
      result = {
        stacksWidthChanges, viewportWidth, viewportHeight
      };
      let prev = this.get('resizePrev');
      this.set('resizePrev', result);
      if (prev) {
        delete result.changed;
        let changed = compareFields(prev, result, compareViewport);
        result.changed = changed;
      }
      dLog('resizeEffect', result);
    if (false) // currently the display is probably smoother with the debounce; later after tidying up the resize structure this direct call may be better.
      this.resize.apply(this, [/*transition*/true]);
    else
      debounce(this, this.resize, [/*transition*/true], 500);
      return result;
  }),

  /** for CP dependency.  Depends on factors which affect the horizontal (X) layout of stacks.
   * When this CP fires, updates are required to X position of stacks / axes, and hence the paths between them.
   * @return value is for devel trace
   */
  stacksWidthChanges : computed(
    'blockService.stacksCount', 'stacksView.splitAxesLength',
    /** panelLayout is mapview .layout */
    'panelLayout.left.visible', 'panelLayout.right.visible',
    function () {
      let count = stacks.length;
      // just checking - will retire stacks.stacksCount anyway.
      if (count != stacks.stacksCount?.count)
        console.log('stacksWidthChanges',  count, '!=', stacks.stacksCount);
      const
      leftPanelShown = this.readLeftPanelToggle(),
      current = {
        stacksCount : count,
        splitAxes : this.get('stacksView.splitAxesLength'),
        // this.get('panelLayout.left.visible') is true, and does not update
        left : leftPanelShown,
        right : this.get('panelLayout.right.visible')
      };
      console.log('stacksWidthChanges', current);
      return current;
    }),
  /** Read the CSS attribute display of left-panel to determine if it is shown / visible.  */
  readLeftPanelToggle() {
      let leftPanel = $('#left-panel'),
      /** leftPanel.hasClass('left-panel-shown') is always true; instead the
       * <div>'s display attribute is toggled between flex and none.
       * using jQuery .toggle() applied to button.left-panel-{shown,hidden},
       * in toggleLeftPanel(), via left-panel.hbs action of button.panel-collapse-button.
       * This could be made consistent with right panel, but planning to use golden-layout in place of this anyway.
       *
       * .attributeStyleMap is part of CSS Typed OM; is in Chrome, not yet Firefox.
       * https://github.com/Fyrd/caniuse/issues/4164
       * https://developer.mozilla.org/en-US/docs/Web/API/CSS_Typed_OM_API
       */
      haveCSSOM = leftPanel[0].hasAttribute('attributeStyleMap'),
      leftPanelStyleDisplay = haveCSSOM ?
        leftPanel[0].attributeStyleMap.get('display').value :
        leftPanel[0].style.display,
      leftPanelShown = leftPanelStyleDisplay != 'none'
    ;
    dLog('readLeftPanelToggle', leftPanel[0], leftPanelShown);
    /* The returned value is used only in trace.  This attribute .leftPanelShown is observed by resize()
 */
    this.set('leftPanelShown', leftPanelShown);
    return leftPanelShown;
  },

  /** @return true if changes in #stacks or split axes impact the width and horizontal layout.
   * (maybe dotPlot / axis.perpendicular will affect width also)
   */
  stacksWidthChanged() {
    /* can change this to a CP, merged with resize() e.g. resizeEffect(), with
     * dependencies on 'blockService.stacksCount', 'splitAxes.[]'
     */
    let previous = this.get('previousRender'),
    now = {
      stacksCount : stacks.length,   // i.e. this.get('blockService.stacksCount'), or oa.stacks.stacksCount.count
      splitAxes : this.get('stacksView.splitAxesLength'),
    },
    changed = ! isEqual(previous, now);
    if (changed) {
      console.log('stacksWidthChanged', previous, now);
      later(() => ! this.isDestroying && this.set('previousRender', now));
    }
    return changed;
  },

  resize : observer(
    'panelLayout.left.visible',
    'panelLayout.right.visible',
    'leftPanelShown',
    'controls.view.showAxisText',
    /* axisTicksOutside doesn't resize, but a redraw is required (and re-calc could be done) */
    'controls.view.axisTicksOutside',
    /* after 'controls.view.extraOutsideMargin' changes, axis x offsets are re-calculated.  related : 'oa.vc.axisXRange' */
    'controls.view.extraOutsideMargin',
    /* ChangeCount represents 'xOffsets.@each.@each', */
    'xOffsetsChangeCount',
    /** split-view : sizes of the components adjacent the resize gutter : 0: draw-map and 1 : tables panel. */
    'componentGeometry.sizes.0',
    'controls.window.tablesPanelRight',
    function() {
      console.log("resize", this, arguments);
      /** resize() may called via .observes(), or
       * via :  window .on('resize' ... resizeThisWithTransition() ... resizeThis()
       * ... Ember.run.debounce(this, this.resize, )
       */
      const 
      calledFromObserve = (arguments.length === 2),
      layoutChanged = calledFromObserve,
      /** This can be passed in along with transition in arguments,
       * when ! calledFromObserve.
       */
      windowResize = ! calledFromObserve,
      oa = this.oa;
      let redrawAxes = arguments[1] === 'controls.view.axisTicksOutside';
      // logWindowDimensions('', oa.vc.w);  // defined in utils/domElements.js
      function resizeDrawing() {
        const vc = oa.vc;
        // if (windowResize)
        eltResizeToAvailableWidth(
          /*bodySel*/ 'div.ember-view > div > div.body > div',
          /*centreSel*/ '.resizable');
        vc.calc(oa);
        const
        drawMap = oa.eventBus,
        widthChanged = (vc.viewPort.w != vc.viewPortPrev.w) || this.stacksWidthChanged(),
        heightChanged = vc.viewPort.h != vc.viewPortPrev.h;

        // rerender each individual element with the new width+height of the parent node
        // need to recalc viewPort{} and all the sizes, (from document.documentElement.clientWidth,Height)
        // .attr('width', newWidth)
        /** Called from .resizable : .on(drag) .. resizeThis() , the browser has
         * already resized the <svg>, so a transition looks like 1 step back and 2
         * steps forward, hence pass transition=false to showResize().
         */
        let useTransition = layoutChanged;
        this.showResize(widthChanged, heightChanged, useTransition);
      }

      const vc = oa.vc;
      console.log("vc", vc, arguments);
      if (vc)
      {
        if (redrawAxes) {
          const stacksView = this.oa.axisApi.stacksView;
          stacksView.stacksRedraw();
        }
        if (false && ! layoutChanged) {
          // Currently debounce-d in resizeThis(), so call directly here.
          resizeDrawing.apply(this);
        } else {
          console.log(arguments[1], arguments[0]);
          /* debounce is used to absorb the progressive width changes of
           * the side panels when they open / close (open is more
           * progressive).
           * After the values panelLayout.{left,right}.visible change, DOM
           * reflow will modify viewport width, so the delay helps with
           * waiting for that.
           */
          debounce(this, resizeDrawing, 300);
        }
      }

    }),
  
  //----------------------------------------------------------------------------

});

/*
  return result;
}

//------------------------------------------------------------------------------

export {
  compareViewport,
  GraphFrame,
};
*/

