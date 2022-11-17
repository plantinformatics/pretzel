/* related : see utils/interval-calcs.js */

/*----------------------------------------------------------------------------*/

import { isEqual } from 'lodash/lang';

//------------------------------------------------------------------------------

/* global d3 */
/* global WheelEvent */

//------------------------------------------------------------------------------

import { maybeFlip, noDomain }  from './axis';
import {
   AxisBrushZoom,
} from './axisBrush';


import normalizeWheel from 'normalize-wheel';


/*----------------------------------------------------------------------------*/
const trace_zoom = 0;
const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/* copied from draw-map.js; this has already been split out of draw-map.js into
 * utils/graph-maths.js in an unpushed branch (8fccbd3).
 * Added : this version handles range[] being in -ve order, i.e. range[0] > range[1].
 * @param a point value
 * @param range interval [start, end]
 * The argument order is opposite to the similar function @see inInterval()
 */
function inRange(a, range)
{
  /* Using == instead of &&, to handle both +/- order of range[]
   * visually,
   *  +ve : range[0] < range[1]
   *          a <= r1
   *    r0 <= a
   *  -ve : range[0] < range[1]
   *     r1 < a               (i.e. ! (a <= range[1]) ==
   *          a < r0                ! (range[0] <= a))
   */
  return (range[0] <= a) == (a <= range[1]);
}
/** Same as inRange / subInterval, using the appropriate function for the type of value a.
 * @param a may be a single value or an interval [from, to]
 * @param range an interval [from, to]
 */
function inRangeEither(a, range)
{
  return a.length ? subInterval(a, range) : inRange(a, range);
}


/** Test if an array of values, which can be a pair defining an interval, are all
 * contained within another interval.
 * @param values  an array of values to test
 */
function subInterval(values, interval) {
      // use `some` so that search completes as soon as one value is found out of range.
  let ok =
    ! values.some(function (d) { return ! inRange(d, interval); });
  return ok;
}

/** Test if any of an array of values, which can be a pair defining an interval, is
 * contained within another interval.
 * This does not treat interval completely contained within values as an overlap,
 * so use overlapInterval() which handles that case.
 * For calculation of the overlap, in interval-calcs.js, @see intervalOverlap()
 * @param values  an array of values to test
 */
function overlapInterval1(values, interval) {
  /* based on subInterval().
  * Note also : interval-calcs.js : intervalOverlap() which calculates the overlapping interval.
  * and interval-overlap.js : inInterval() and inDomain(), which are equivalent, but look less efficient.
  */
      // use `any` so that search completes as soon as one value is found in range.
  let ok =
    values.any(function (d) { return inRange(d, interval); });
  return ok;
}
function overlapInterval(values, interval) {
  return overlapInterval1(values, interval) ||
    overlapInterval1(interval, values);
}


/** This handles 1 end of the interval for @see constrainInterval().
 */
function constrainInterval1(sub, interval, i) {
  if ( ! inRange(sub[i], interval)) {
    /** other end of the interval from i */
    let j = 1 - i;
    /** Add shift to sub[] */
    let shift = interval[i] - sub[i];
    sub[i] = interval[i];
    let
      sjs = sub[j] + shift,
    /** true if it is not possible to shift sub[j] because sjs is outside interval[j].  */
    outside = j ? sjs > interval[j] : sjs < interval[j];
    /** if shifted sub[j] would be outside interval[j], then clamp it at interval[j] */
    sub[j] = outside ? interval[j] : sjs;
  }
}
/** Shift sub so that it fits within interval.
 * The caller ensures that length of sub is < length of interval.
 *
 * @param sub array[2] numeric
 * @param interval  array[2] numeric
 */
function constrainInterval(sub, interval) {
  [0, 1].forEach(function (i) {
    constrainInterval1(sub, interval, i);
  });
}

/** @return true if interval direction is +ve, i.e. interval[0] < interval[1] */
function intervalSign(interval) {
  return interval[0] < interval[1];
}

/** Ensure that the direction of the interval is direction.
 * @param direction true === increasing interval (positive)
 */
function intervalDirection(interval, direction) {
  if (intervalSign(interval) !== direction) {
    interval = [interval[1], interval[1]];
  }
  return interval;
}

/*----------------------------------------------------------------------------*/

/** Calculate the domain resulting from a mousewheel action (WheelEvent), which
 * is interpreted as a pan if the shift key is depressed, and a zoom otherwise.
 *
 * This is used first by zoomFilter() (d3.zoom().filter()) to check if the event
 * should be included or ignored, then called from zoom() (d3.zoom().on('zoom'))
 * to implement the event.  The GUI philosophy of this is if the event would
 * move the domain outside the permitted limits then position it at the limit it
 * would exceed.  The limits are axisReferenceDomain and lowerZoom (the lower
 * limit on zoom).  If the domain is already at that limit, then zoomFilter()
 * can ignore the event because it would have no effect.
 * So include indicates that the event is already constrained in the direction
 * it is going.
 *
 * zoom : if interval > domainSize, set it to that limit
 * zoom & pan : if one (either) end of newDomain is outside axisReferenceDomain, set it to that limit
 *
 * Uses : d3.event,
 * d3.event.sourceEvent (! inFilter), d3.event.currentTarget (! inFilter && ! isPan)
 *
 * @param axis  Stacked
 * @param axisApi for axisRange2Domain()
 * @param inFilter  true when called from zoomFilter() (d3.zoom().filter()),
 * false when called from zoom() (d3.zoom().on('zoom')); this indicates
 * variation of the event information structure.
 * @return inFilter ? include : newDomain
 * include is a flag for which true means don't filter out this event.
 * newDomain is the new domain resulting from the zoom change.
 */
function wheelNewDomain(axis, axisApi, inFilter) {
  let yp = axis.y;
  /* if the axis does not yet have a domain then it won't have a scale.
   * The domain should be received before the user can excercise the scroll
   * wheel, but if this can happen if there is an error in requesting block
   * features.
   */
  if (! yp) return inFilter ? false : undefined;
  /** Access these fields from the DOM event : .shiftKey, .deltaY, .currentTarget.
   * When called from zoom(), d3.event is the d3 wrapper around the event, and
   * the DOM event is referenced by .sourceEvent,  whereas in zoomFilter()
   * d3.event is the DOM event.
   */
  let e = inFilter ? d3.event : d3.event.sourceEvent,
  isPan = e.shiftKey;
  if (trace_zoom > 1)
    dLog(axis, inFilter, 'zoom Wheel scale', yp.domain(), yp.range(), e /*, oa.y, oa.ys */);
  const normalized = normalizeWheel(e);
  if (trace_zoom)
    dLog('normalizeWheel', normalized);

  /** the element which is the target of the WheelEvent zoom/pan
   * It is available as `this` in zoomFilter();  can instead be accessed via d3.event.currentTarget
   */
  let elt = e.currentTarget;

  let
    flipped = axis.flipped,
    /** current domain of y scale. */
    domain = yp.domain(),
  /** interval is signed. */
  interval = domain[1] - domain[0],
  /** This is the result of zoom() */
  newDomain,
  /** this is the result of zoom filter.
   * Ignore event if it would have no effect, because it is constrained by limits.
   */
  include;

  let
    axis1dReferenceDomain = axis.axis1d && axis.axis1d.get('blocksDomain'),
    /** the whole domain of the axis reference block.
     * If the axis does not have a reference block with a range, as in the case
     * of GMs, use the domain of the reference Block
     * Prefer to use axis1dReferenceDomain because it is updated by CP, and 
     * initially axis.referenceBlockS().domain may be [false, false].
     * The latter is unlikely to be needed and can be dropped.
     *
     * Sign is +ve for blocksDomain, and referenceBlock.range will normally be
     * +ve but it could be -ve, e.g. if a user script generates the range in
     * reverse order.
     */
    axisReferenceDomain = axis1dReferenceDomain ||
    (axis.referenceBlock && axis.referenceBlock.get('range')) ||
    axis.referenceBlockS().domain;
  
  if (noDomain(axisReferenceDomain)) {
    if (trace_zoom)
      dLog('wheelNewDomain() no domain yet', axisReferenceDomain);
    axisReferenceDomain = undefined;
  }
  if (axisReferenceDomain === undefined) {
    if (! isPan)
      // zoom calculate depends on axisReferenceDomain, domainSize.
      return false;
  }
  let axisReferenceDomainF = axisReferenceDomain && maybeFlip(axisReferenceDomain, flipped);
  let
    /** domainSize is positive. */
    domainSize = axisReferenceDomain && Math.abs(axisReferenceDomain[1] - axisReferenceDomain[0]),
  /** lower limit for zoom : GM : about 1 centiMorgan, physical map : about 1 base pair per pixel  */
  lowerZoom = domainSize > 1e6 ? 50 : domainSize / 1e5,
  /** constraint on the length of the domain, aka interval, newInterval. */
  intervalLimit = [lowerZoom, (domainSize || 5e8)];

  let
    deltaY = normalized.pixelY;  // equivalent to e.deltaY;

  if (trace_zoom > 1)
    console.log(axisReferenceDomain);
  // detect if domain is not flipped as expected
  if (flipped != (interval < 0)) // i.e. intervalSign(domain))
      console.log(domain, interval, 'flipped', flipped);


  if (isPan) {
    if (flipped)
      deltaY = - deltaY;
    let
      delta = deltaY/300,
    /** amount to shift domain by */
    newInterval = interval * delta;
    newDomain =
      [
        domain[0] + newInterval,
        domain[1] + newInterval
      ];

    if (trace_zoom > 1)
      console.log(deltaY, delta, 'newInterval', newInterval, newDomain);
  }
  else /* zoom */ {
    /** mousePosition used as centre for zoom, not used for pan. */
    let mousePosition = elt && d3.mouse(elt);
    if ((trace_zoom > 1) && mousePosition)
      console.log('mousePosition', mousePosition);
    let
      range = yp.range(),
    rangeYCentre = mousePosition[1];
    if (rangeYCentre === undefined) {
      dLog('mousePosition has no [1]', mousePosition);
      return false;
    }
    let
    axisBrushZoom = AxisBrushZoom(axisApi.drawMap.oa),
    /** This is the centre of zoom, i.e. the mouse position, not the centre of the axis.  */
    centre = axisBrushZoom.axisRange2Domain(axis.axisName, rangeYCentre),

    transform = inFilter ? elt.__zoom : d3.event.transform, // currently only used in trace

    deltaScale = 1 + deltaY/300,
    /** length of new domain.  Positive.
     * newInterval is defined in both the Pan and Zoom cases; they are 2 similar but distinct variables.
     */
    newInterval = Math.abs(interval * deltaScale),
    rangeSize = range[1] - range[0];
    // similar to subInterval(newInterval, intervalLimit)
    if (domainSize && (newInterval > domainSize)) {
      console.log('limit newInterval', newInterval, domainSize);
      newInterval = domainSize * Math.sign(interval);
      newDomain = axisReferenceDomainF;
    }
    else {
      if (newInterval < intervalLimit[0]) {
        newInterval = intervalLimit[0];
      }
      newInterval *= Math.sign(interval);

      newDomain = [
        // can use zoom.center() for this.
        // range[0] < rangeYCentre, so this first offset from centre is -ve
        centre + newInterval * (range[0] - rangeYCentre) / rangeSize,
        centre + newInterval * (range[1] - rangeYCentre) / rangeSize
      ];
    }
    // Both newInterval and newDomain are signed (i.e. in the direction of .flipped).

    // detect if domain is becoming flipped during zoom
    if (flipped != ((interval > 0) !== intervalSign(newDomain)))
      console.log(domain, deltaScale, newInterval, interval, newDomain, 'flipped', flipped);

    if (trace_zoom > 1)
      console.log(rangeYCentre, rangeSize, 'centre', centre);
    if (trace_zoom > 1)
      console.log(deltaY, deltaScale, transform, 'newInterval', newInterval, newDomain);
  }

  // if one (either) end of newDomain is outside axisReferenceDomainF, set it to that limit
  if (axisReferenceDomainF && ! subInterval(newDomain, axisReferenceDomainF))
  {
    console.log('! subInterval', newDomain, axisReferenceDomainF);
    constrainInterval(newDomain, axisReferenceDomainF);
    console.log('result of constrainInterval', newDomain);
  }

  if (inFilter) {
    /* constrainInterval() will pan newDomain so that it fits within
     * axisReferenceDomain, and newInterval is constrained to intervalLimit,
     * so newDomain fits;  skip event if newDomain is unchanged from domain.
     * Precision limit may cause jitter here; could insted use e.g. euler_distance((domain - newDomain) / (domain + newDomain)) < 1e-4
     */
    include = ! isEqual(newDomain, domain);

    if (trace_zoom)
      dLog('include', include);
  }

  return inFilter ? include : newDomain;
}

/*----------------------------------------------------------------------------*/

function ZoomFilter(oa) {

  const result = {
    wheelDelta,
    zoomFilter,
  };

  /** default is 500.  "scaling applied in response to a WheelEvent ... is
   * proportional to 2 ^ result of wheelDelta(). */
  let wheelDeltaFactor = 500 * 3 * 8;
  dLog('wheelDeltaFactor', wheelDeltaFactor);
  function wheelDelta() {
    return -d3.event.deltaY * (d3.event.deltaMode ? 120 : 1) / wheelDeltaFactor;
  }
  function zoomFilter(d) {
    let  e = d3.event;
    let  include;
    /** WheelEvent is a subtype of MouseEvent; click to drag axis gets
     * MouseEvent - this is filtered out here so it will be handle by dragged().
     * ! d3.event.button is the default zoom.filter, possibly superfluous here.
     */
    let isMouseWheel = (d3.event instanceof WheelEvent) && ! d3.event.button;
    if (isMouseWheel) {

      if (e.shiftKey && trace_zoom > 1) {
        dLog('zoom.filter shiftKey', this, arguments, d3.event, d);
      }

      let axisName = d,
      axis = oa.axesP[axisName];

      if ((oa.y[axisName] !== axis.y) || (oa.ys[axisName] !== axis.ys))
        dLog('zoomFilter verify y', axisName, axis, oa);
      if (axis.axisName !== d)
        dLog('zoomFilter verify axisName', axisName, axis);

      include = wheelNewDomain(axis, oa.axisApi, true); // uses d3.event
    }
    return include;
  }

  //----------------------------------------------------------------------------

  return result;
}


//------------------------------------------------------------------------------

export {
  inRange, inRangeEither, subInterval, overlapInterval,
  intervalSign,
  intervalDirection,
  wheelNewDomain,
  ZoomFilter,
};
