import Ember from 'ember';

/*global d3 */

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
 * @return undefined if selectors eltSelector or resizer don't match, otherwise
 * the d3 drag object, so that the caller can register for drag events.
 * The caller could use eltWidthResizable(...).on('drag') instead of passing resized,
 * but this function wraps the calculation of x and dx which is useful.
 */
function eltWidthResizable(eltSelector, filter, resized)
{
  /** refn : meetamit https://stackoverflow.com/a/25792309  */
  let resizable = d3.select(eltSelector);

    let resizer = resizable.select('.resizer');

  if ((resizable.node() === null) || (resizer.node() === null))
    {
    console.log("eltWidthResizable() resizer=", resizer, eltSelector, resizable.node(), resizer.node());
      return undefined;
  }
    /* instead of return: else { ...  } */

  /** assumes single '.resizer', or they all have some flex-grow. */
let
  resizable_flex_grow = resizable.node().style['flex-grow'];

  let startX;
  let dragResize = d3.drag()  // d3 v3: was .behavior
    .on('drag', function(d, i, g) {
      logElementDimensions(g[0], 'on drag');

      // as for .resize() below,
      // .on() seems to apply a reasonable debounce, but if not, use Ember.run.debounce()
      // Determine resizer position relative to resizable (parent)
      let x = d3.mouse(this.parentNode)[0];
      let dx = d3.event.dx;
      // console.log("eltWidthResizable drag x=", x, dx);
      // Avoid negative or really small widths
      // (perhaps if x < 50, don't call resized() or set width.)
      x = Math.max(50, x);

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

      if (resizedOk === undefined || resizedOk) 
        resizable.style('width', x + 'px');

    });
  // if (filter)
    dragResize.filter(shiftKeyfilter/*filter*/);

  /* If the window size is changed (in particular reduced then increased),
   * restore the previous value, so that the flex-grow can
   * automatically absorb the increased width.
   */
  let w =
    Ember.$( window );
  console.log(w);
    w.resize(function(e) {
        console.log("w.resize", e); // 'this' is Window
    /*  .resize() may apply some debounce also - refn https://api.jquery.com/resize/.
     * Seems that the version used is frontend/bower_components/jquery/dist/jquery.js
     * (noting also bower_components/jquery-ui/ui/widgets/resizable.js).
     */
      Ember.run.debounce(resizeEnd, 300);
  });
  function resizeEnd() { 
      console.log("eltWidthResizable window resize", eltSelector, resizable_flex_grow);
    logWindowDimensions(window, 'drag');
    resizable.style('flex-grow', resizable_flex_grow);
  };


  if (resizer.size())
    resizer.call(dragResize);
  else
    console.log("eltWidthResizable() resizer=", resizer, eltSelector, dragResize);
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
  a1=Ember.$(bodySel),
  body =  a1,
  bodyWidth = a1.innerWidth(),
  siblingWidth = 0,
  siblings = Ember.$(bodySel + ' > *')
    .each(function (i, elt) { siblingWidth += elt.clientWidth; } )
    .each(function (i, elt) { console.log(i, elt, elt.clientWidth); } )
  ,
  a = siblings,
  ar=a.filter(centreSel),
  centreDiv = ar,

  sidePanelWidth = siblingWidth - centreDiv.width(),
  spareWidth = bodyWidth - sidePanelWidth;

  console.log('eltResizeToAvailableWidth', bodyWidth, centreDiv, a.length, bodyWidth, sidePanelWidth, spareWidth);
  ar.innerWidth(spareWidth);
}


function logWindowDimensions(w, text)
{
  /** visualViewport enables distinction of visual and layout viewports, relevant to pinch-zoom.
   * Only available on Chrome so far :
   * https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport#Browser_compatibility
   */
  let s = w.screen, v = w.visualViewport;
  console.log
  (
    text, 'inner', w.innerWidth, "x", w.innerHeight, 
    'avail', s.availWidth, 'x',  s.availHeight,
    'screen', s.width, 'x', s.height,
    'visualViewport', v && ('' + v.width + 'x' + v.height)
  );
}

function logElementDimensions(e, text)
{
  console.log
  (
    text,
    'client', e.clientWidth, 'x', e.clientHeight, e.clientLeft, ',', e.clientTop,
    'offset', e.offsetWidth, 'x', e.offsetHeight, e.offsetLeft, ',', e.offsetTop, e.offsetParent,
    'scroll', e.scrollWidth, 'x', e.scrollHeight, e.scrollLeft, ',', e.scrollTop
  );
}

function logElementDimensions2(jq) {
  let e = jq[0];
  console.log(
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



/** recognise any punctuation in f which is not allowed for a selector matching an element class name,
 * and replace with _
 * Specifically :
 *   replace non-alphanumeric characters with their hex encoding @see cssHexEncode(),
 *   prefix leading digit with _
 *
 * HTML5 class names allow these forms, so eltClassName() is only required
 * where the class name will be the target of a selector.
 * CSS selectors can use \ escaping e.g. to prefix '.', and that works for
 * d3.select() and Ember.$() selectors (using \\);  for now at least
 * the simpler solution of replacing '.' with '_' is used.
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
  let fString = (typeof(f) == 'string') ? f : '' + f,
  fPrefixed = cssHexEncode(fString.replace(/^([\d])/, "_$1"));
  return fPrefixed;
}

/*----------------------------------------------------------------------------*/

function tabActive(jqSelector)
{
  let elt$ = Ember.$(jqSelector),
  active = elt$.hasClass('active');
  console.log('tabActive', jqSelector, active, elt$[0], elt$.length);
  return active;
}

/** Return the slider value of the identified <input> element.
 * @param inputId e.g. "range-pathDensity"
 * @return (type is number) value, or undefined if inputId matches 0 or >1 elements
 */
function inputRangeValue(inputId)
{
  // based on part of setupInputRange()
  let input = Ember.$("#" + inputId);
  if (input.length !== 1)
    console.log('inputRangeValue', inputId, input.length, input.length && input[0]);
  // .value is a string, so convert to number.
  return (input.length === 1) ? +input[0].value : undefined;
}

/** 
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

export {
  eltWidthResizable,
  eltResizeToAvailableWidth,
  logWindowDimensions, logElementDimensions, logElementDimensions2,
  shiftKeyfilter, noShiftKeyfilter ,
  htmlHexEncode, cssHexEncode,
  eltClassName,
  tabActive,
  inputRangeValue,
  expRangeBase,
  expRange,
  expRangeInitial
 };
