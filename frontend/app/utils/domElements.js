import { debounce } from '@ember/runloop';
import $ from 'jquery';

/*global d3 */
/* global CSS */

const trace_dom = 0;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** Make the given DOM element width resizable;  it is expected to contain an element
 * .resizer, which is what the user drags.
 * The .resizer is styled to position to the right or left edge :
 * e.g. <div class="resizer" style="float:right; width:10px; height:10px">X</div>
 * or instead of float:right could use position: absolute; right: -5px;
 * and with a suitable horizontal resize icon e.g. glyphicon-resize-horizontal 
 * or http://fontawesome.io/3.2.1/icon/resize-horizontal/
 *
 * This is equivalent to jquery-ui .resizable(), which is not working with the
 * current set of framework and tools versions
 *  ("TypeError: this._handles.disableSelection is not a function").
 *
 * Usage eg.     eltWidthResizable('#holder');
 *
 * @param eltSelector DOM element to make resizable
 * @param filter  undefined or event filter - refn github.com/d3/d3-drag#drag_filter
 * @param resized undefined or callback when resized
 * @param vertical if true, adjust y / height, otherwise x / width
 * @return undefined if selectors eltSelector or resizer don't match, otherwise
 * the d3 drag object, so that the caller can register for drag events.
 * The caller could use eltWidthResizable(...).on('drag') instead of passing resized,
 * but this function wraps the calculation of x and dx which is useful.
 */
function eltWidthResizable(eltSelector, filter, resized, vertical = false)
{
  /** refn : meetamit https://stackoverflow.com/a/25792309  */
  let resizable = d3.select(eltSelector);

    let resizer = resizable.select('.resizer');

  if (resizer.empty() && ! resizable.empty()) {
    const r = $(eltSelector),
    s = r.append('<div><span class="resizer vertical"></span></div>');
    dLog('eltWidthResizable', s[0]);
    resizer = resizable.select('.resizer');
  }
  if ((resizable.node() === null) || (resizer.node() === null))
    {
    dLog("eltWidthResizable() resizer=", resizer, eltSelector, resizable.node(), resizer.node());
      return undefined;
  }
    /* instead of return: else { ...  } */

  /** assumes single '.resizer', or they all have some flex-grow. */
let
  resizable_flex_grow = resizable.node().style['flex-grow'];

  let startX;
  let dragResize = d3.drag()  // d3 v3: was .behavior
    .on('drag', function(d, i, g) {
      if (trace_dom)
        logElementDimensions(g[0], 'on drag');

      // as for .resize() below,
      // .on() seems to apply a reasonable debounce, but if not, use Ember.run.debounce()
      // Determine resizer position relative to resizable (parent)
      let relativeParent = (this.parentNode.parentNode.parentNode.tagName === 'foreignObject') ?
        this.parentNode.parentNode.parentNode.parentNode.parentNode.parentNode : this.parentNode;
      const
      mousePosition = d3.mouse(relativeParent),
      /** means y if vertical */
      x_ = mousePosition[+vertical],
      event = d3.event,
      /** means dy if vertical */
      dx = event[vertical ? 'dy' : 'dx'],
      // dLog("eltWidthResizable drag x=", x, dx);
      // Avoid negative or really small widths
      // (perhaps if x < 50, don't call resized() or set width.)
      x = Math.max(50, x_);

      /** if resized is given, and it returns a value, then only update width if value is truthy. */
      let resizedOk;

      /* If the parent (resizable) has "flex-grow: 1", disable that so that it can be adjusted.
       */
      resizable.style('flex-grow', 'inherit');

      if (resized)
        resizedOk =
        // 'this' is resizer elt.
        // Only the first 2 args are used so far - the others can be dropped.
        resized(x, dx, eltSelector, resizable, resizer, this, d);

      if (resizedOk === undefined || resizedOk) {
        const dimension = vertical ? 'height' : 'width';
        // or use $(resizable.node())[dimension] = ..., to avoid overriding other element style.
        resizable.style(dimension, x + 'px');
      }
    });
  // if (filter)
    dragResize.filter(shiftKeyfilter/*filter*/);

  /* If the window size is changed (in particular reduced then increased),
   * restore the previous value, so that the flex-grow can
   * automatically absorb the increased width.
   */
  let w =
    $( window );
  if (trace_dom)
    dLog(w);
    w.resize(function(e) {
        if (trace_dom)
          dLog("w.resize", e); // 'this' is Window
    /*  .resize() may apply some debounce also - refn https://api.jquery.com/resize/.
     * Seems that the version used is frontend/bower_components/jquery/dist/jquery.js
     * (noting also bower_components/jquery-ui/ui/widgets/resizable.js).
     */
      debounce(resizeEnd, 300);
  });
  function resizeEnd() { 
    if (trace_dom) {
      dLog("eltWidthResizable window resize", eltSelector, resizable_flex_grow);
      logWindowDimensions(window, 'drag');
    }
    resizable.style('flex-grow', resizable_flex_grow);
  };


  if (resizer.size())
    resizer.call(dragResize);
  else
    if (trace_dom)
      dLog("eltWidthResizable() resizer=", resizer, eltSelector, dragResize);
    return dragResize;
}


/** Given a parent div which contains some left and right side panels, and a
 * centre div, recalculate the width of the centre div, based on the widths of
 * the side panels and the parent div.
 *
 * @param bodySel   jQuery selector for the parent div,
 * e.g. bodySel = 'div.ember-view > div > div.body > div',
 * @param centreSel jQuery .filter() selector for the centre div, relative to bodySel,
 * e.g. centreSel = '.resizable',
 */
function eltResizeToAvailableWidth(bodySel, centreSel)
{
  let
  a1=$(bodySel),
  body =  a1,
  bodyWidth = a1.innerWidth(),
  siblingWidth = 0,
  siblings = $(bodySel + ' > *')
    .each(function (i, elt) { siblingWidth += elt.clientWidth; } );
  if (trace_dom)
    siblings
    .each(function (i, elt) { dLog(i, elt, elt.clientWidth); } );
  let
  a = siblings,
  ar=a.filter(centreSel),
  centreDiv = ar,

  sidePanelWidth = siblingWidth - centreDiv.width(),
  spareWidth = bodyWidth - sidePanelWidth;

  if (trace_dom)
    dLog('eltResizeToAvailableWidth', bodyWidth, centreDiv, a.length, bodyWidth, sidePanelWidth, spareWidth);
  ar.innerWidth(spareWidth);
}


function logWindowDimensions(w, text)
{
  /** visualViewport enables distinction of visual and layout viewports, relevant to pinch-zoom.
   * Only available on Chrome so far :
   * https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport#Browser_compatibility
   */
  let s = w.screen, v = w.visualViewport;
  dLog
  (
    text, 'inner', w.innerWidth, "x", w.innerHeight, 
    'avail', s.availWidth, 'x',  s.availHeight,
    'screen', s.width, 'x', s.height,
    'visualViewport', v && ('' + v.width + 'x' + v.height)
  );
}

function logElementDimensions(e, text)
{
  dLog
  (
    text,
    'client', e.clientWidth, 'x', e.clientHeight, e.clientLeft, ',', e.clientTop,
    'offset', e.offsetWidth, 'x', e.offsetHeight, e.offsetLeft, ',', e.offsetTop, e.offsetParent,
    'scroll', e.scrollWidth, 'x', e.scrollHeight, e.scrollLeft, ',', e.scrollTop
  );
}

function logElementDimensions2(jq) {
  let e = jq[0];
  dLog(
    'client',
    e.clientHeight, e.clientWidth, e.clientLeft, e.clientTop,
    e.getBoundingClientRect(),
    'jq',
    jq.width(),
    jq.innerWidth(),
    jq.outerWidth(),
    jq.height(),
    jq.innerHeight(),
    jq.outerHeight(),
    jq.position()
  );
}


/*----------------------------------------------------------------------------*/

/** Event filter for eltWidthResizable() ... d3 drag.filter()
 *  refn github.com/d3/d3-drag#drag_filter
 */
function shiftKeyfilter() {
  let ev = d3.event.sourceEvent || d3.event; 
  return ev.shiftKey;
}

function noShiftKeyfilter() {
  let ev = d3.event.sourceEvent || d3.event; 
  return ! ev.shiftKey;
}

function ctrlKeyfilter() {
  let ev = d3.event.sourceEvent || d3.event; 
  return ev.ctrlKey;
}

/** accept events without a key modifier, i.e. no Shift, Ctrl or Alt.
 * Used for axis brush.
 * These can be replaced by .keyModifier([d3.event.shiftKey]) after upgrading to d3 v4.
 */
function noKeyfilter() {
  let ev = d3.event.sourceEvent || d3.event; 
  return ! ev.shiftKey && ! ev.ctrlKey && ! ev.altKey;
}


/*----------------------------------------------------------------------------*/

/** 
 * @param text  e.g. feature name
 * based on : https://stackoverflow.com/a/1354491
 */
function htmlHexEncode(text)
{
  var html = text.replace(/[\u00A0-\u00FF]/g, function(c) {
    return '&#'+c.charCodeAt(0)+';';
  });
  return html;
}

/** Encode a text feature name which may contain punctuation into a form suitable for use a CSS class name. 
 * Use CSS.escape() instead of this function.
 * @param text  e.g. feature name
 */
function cssHexEncode(text)
{
    /** based on : https://stackoverflow.com/a/1354491,
     * changes are :
     * . use css \ prefix,
     * . use 6 hex chars \xxxxxx, so that trailing space is not required.
     * described in https://www.w3.org/International/questions/qa-escapes
     */
  var html = text.replace(/[^-_A-Za-z0-9]/g, function(c) {
    let c0 = c.charCodeAt(0);
    // prefix a 5th '0' if c is <0x10, so that there are 6 hex chars
    return '\\0000'+ ((c0 < 0x10) ? '0' : '' ) + c0.toString(16);
  });
  return html;
}

// -----------------------------------------------------------------------------

/** Wrap CSS.escape() : handle leading digit (which would otherwise be escaped).
 */
function escapeCSS(value) {
  let valueEsc;
  if (typeof value != "string") {
    value = '' + value;
  }
  if (value.match(/^[0-9]/)) {
    /** prefix with alpha character so that CSS.escape() does not convert an initial digit to \hex */
    valueEsc = CSS.escape('a' + value).slice(1);
  } else {
    valueEsc = CSS.escape(value);
  }
  return valueEsc;
}
  
// -----------------------------------------------------------------------------



/** recognise any punctuation in f which is not allowed for a selector matching an element class name,
 * and replace with _
 * Specifically :
 *   use CSS.escape() to escape punctuation which is not accepted in CSS selectors
 *   prefix leading digit with _
 *
 * HTML5 class names allow these forms, so eltClassName() is only required
 * where the class name will be the target of a selector.
 * CSS selectors can use \ escaping e.g. to prefix '.', and that works for
 * d3.select() and Ember.$() selectors (using \\);
 * This is now done, using CSS.escape().
 * CSS.escape() maps . to \. (which appears as \\. in console); this does not
 * currently appear to work in jQuery $() and d3.select{,All}(), so replace
 * '.' with '_'.
 *
 * Earlier versions
 * replaced non-alphanumeric characters with their hex encoding @see cssHexEncode(),
 *
 * A class with a numeric prefix is accepted by HTML5, but not for selectors (CSS, d3 or $),
 * so eltClassName() is required at least for that.
 */
function eltClassName(f)
{
  /** Some genetic maps use integer numbers for marker names, these may appear
   * in .json upload without wrapping "".  That will likely cause problems
   * elsewhere, but handle it here by converting f to a string.
   */
  let fString = (typeof(f) == 'string') ? f : '' + f;
  fString = fString.replaceAll('.', '_');
  let
  /** d3.selectAll() is not matching the result of CSS.escape() on marker names
   * starting with a digit. Prefixing with _ first works.  Then CSS.escape() can
   * handle any following punctuation.
   */
  fPrefixNumber = fString.replace(/^([\d])/, "_$1"),
  fPrefixed = CSS.escape(fPrefixNumber); // cssHexEncode();
  return fPrefixed;
}

/*----------------------------------------------------------------------------*/

function tabActive(jqSelector)
{
  let elt$ = $(jqSelector),
  active = elt$.hasClass('active');
  if (trace_dom)
    dLog('tabActive', jqSelector, active, elt$[0], elt$.length);
  return active;
}

/** Return the slider value of the identified <input> element.
 * @param inputId e.g. "range-pathDensity"
 * @return (type is number) value, or undefined if inputId matches 0 or >1 elements
 */
function inputRangeValue(inputId)
{
  // based on part of setupInputRange()
  let input = $("#" + inputId);
  if (input.length !== 1)
    dLog('inputRangeValue', inputId, input.length, input.length && input[0]);
  // .value is a string, so convert to number.
  return (input.length === 1) ? +input[0].value : undefined;
}

/*----------------------------------------------------------------------------*/
/* expRange{Base,,Initial)() support exponential values in input range sliders */

/** The ratio by which linear changes in the slider value change the
 * output (exponential) value.
 */
function expRangeBase(steps, rangeMax) {
  return  Math.pow(Math.E, Math.log(rangeMax) / steps);
}
/** Map the given value into an exponential range.

 * This is used for sliders whose result is used as a factor, e.g. 1/2, 1, 2*
 * should result from evenly spaced movement of the slider.
 *
 * Based on
 * @see updateSbSizeThresh()
 * @see expRangeBase()
 * @see expRangeInitial()
 */
function expRange(value, steps, rangeMax /*, domainMax*/)
{
  let
    base = expRangeBase(steps, rangeMax),
  exp = Math.pow(base, value);  // in original updateSbSizeThresh() use :  - 1
  return exp;
}

/** These expRange*() functions were based in part on updateSbSizeThresh() which
 * they now replace;  this comment from updateSbSizeThresh() is retained as an
 * indication of the logic behind the calculations :
 *
 * goal : aim is ~50 steps from 0 to 1000, with an initial/default value of 20.
 * base : x
 * x^50 = 1000 => 50 log(x) = log(1000) => x = e ^ log(1000) / 50
 * x = Math.pow(2.718, Math.log(1000) / 50) = 1.1481371748750222
 *	initial/default value of slider : y
 * x^y = 20 => y log(x) = log(20) => y = Math.log(20) / Math.log(1.148137) = 21.6861056
 * round to 22
 * so : in .hbs : id="range-sbSizeThreshold" :  min="0" max="50" value="22"
 * The above is sufficient for GM, but for genome reference assembly :
 * Math.pow(Math.E, Math.log(1e7) / 50)
 * 1.3803381276035693
 * Math.log(20) / Math.log($_)
 * 9.294035042848378
 *
 * stepRatio is now expRangeBase().
 * const stepRatio = Math.pow(Math.E, Math.log(1e7) / 50);
 * me.set('sbSizeThreshold', Math.round(Math.pow(stepRatio, value)));
 */

/**	initial/default value of slider : y
 *
 * x^y = 20 => y log(x) = log(20) => y = Math.log(20) / Math.log(1.148137) = 21.6861056
 *
 rangeStart = e.g. 20
 */
function expRangeInitial(rangeStart, base) {
  let
  y = Math.log(rangeStart) / Math.log(base);
  return y;
}

/*----------------------------------------------------------------------------*/

function svgRootSelect() {
  const svgRoot = d3.select('#holder > svg');
  return svgRoot;
}


function setCssVariable(name, value)
{
  const svgRoot = svgRootSelect();
  svgRoot.style(name, value);
}

function svgRootClassed(className, value) {
  const svgRoot = svgRootSelect();
  svgRoot.classed(className, value);
  return svgRoot;
}




/*----------------------------------------------------------------------------*/

/** Parse the error message out of
 * @param responseText from error.responseText
 * @desc
 * Related : components/form/base.js : checkError(), handleError(),
 * some of which could be factored to this library.
 */
function responseTextParseHtml(responseText) {
  const
  fnName = 'responseTextParseHtml',
  parser = new DOMParser(),
  doc = parser.parseFromString(responseText, 'text/html'),
  // doc.querySelector('title')
  pre = doc?.querySelector('body pre'),
  // &nbsp; precedes "at"
  text = pre?.textContent.replace(/at \/.*/, '');
  return text;
}

//------------------------------------------------------------------------------

export {
  eltWidthResizable,
  eltResizeToAvailableWidth,
  logWindowDimensions, logElementDimensions, logElementDimensions2,
  shiftKeyfilter, noShiftKeyfilter, ctrlKeyfilter, noKeyfilter,
  htmlHexEncode, cssHexEncode, escapeCSS,
  eltClassName,
  tabActive,
  inputRangeValue,
  expRangeBase,
  expRange,
  expRangeInitial,
  svgRootSelect,
  setCssVariable,
  svgRootClassed,
  responseTextParseHtml,
 };
