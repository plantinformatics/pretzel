
/* global d3 */

/*----------------------------------------------------------------------------*/
const trace_zoom = 2;
/*----------------------------------------------------------------------------*/

/* copied from draw-map.js; this has already been split out of draw-map.js into
 * utils/graph-maths.js in an unpushed branch (8fccbd3).
 */
function inRange(a, range)
{
  return range[0] <= a && a <= range[1];
}

/** Test if an array of values, which can be a pair defining an interval, is
 * contained within another interval.
 * @param values  an array of values to test
 */
function subInterval(values, interval) {
      // use `some` so that search completes as soon as one value is found out of range.
  let ok =
    ! values.some(function (d) { return ! inRange(d, interval); });
  return ok;
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
    sub[j] += shift;
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


/*----------------------------------------------------------------------------*/

/** Calculate the domain resulting from a mousewheel action (WheelEvent), which
 * is interpreted as a pan if the shift key is depressed, and a zoom otherwise.
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
 */
function wheelNewDomain(axis, axisApi, inFilter) {
  let yp = axis.y;
  /** Access these fields from the DOM event : .shiftKey, .deltaY, .currentTarget.
   * When called from zoom(), d3.event is the d3 wrapper around the event, and
   * the DOM event is referenced by .sourceEvent,  whereas in zoomFilter()
   * d3.event is the DOM event.
   */
  let e = inFilter ? d3.event : d3.event.sourceEvent,
  isPan = e.shiftKey;
  if (trace_zoom > 1)
    console.log(axis, inFilter, 'zoom Wheel scale', yp.domain(), yp.range(), e /*, oa.y, oa.ys */);

  /** the element which is the target of the WheelEvent zoom/pan
   * It is available as `this` in zoomFilter();  can instead be accessed via d3.event.currentTarget
   */
  let elt = e.currentTarget;

  let
    /** current domain of y scale. */
    domain = yp.domain(),
  interval = domain[1] - domain[0],
  /** This is the result of zoom() */
  newDomain,
  /** this is the result of zoom filter */
  include;

  let
    /** the whole domain of the axis reference block */
    axisReferenceDomain = axis.referenceBlock && axis.referenceBlock.get('range'),
  domainSize = axisReferenceDomain && axisReferenceDomain[1],
  /** lower limit for zoom : GM : about 1 centiMorgan, physical map : about 1 base pair per pixel  */
  lowerZoom = domainSize > 1e6 ? 50 : domainSize / 1e5;

  let
    deltaY = e.deltaY;

  if (trace_zoom > 1)
    console.log(axisReferenceDomain);

  if (isPan) {
    if (axis.flipped)
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
    if (inFilter) {
      include = subInterval(newDomain, axisReferenceDomain);
    }
    if (trace_zoom > 1)
      console.log(deltaY, delta, 'newInterval', newInterval, newDomain, include);
  }
  else /* zoom */ {
    /** mousePosition used as centre for zoom, not used for pan. */
    let mousePosition = elt && d3.mouse(elt);
    if ((trace_zoom > 1) && mousePosition)
      console.log('mousePosition', mousePosition);
    let
      range = yp.range(),
    rangeYCentre = mousePosition[1],
    /** This is the centre of zoom, i.e. the mouse position, not the centre of the axis.  */
    centre = axisApi.axisRange2Domain(axis.axisName, rangeYCentre),

    transform = inFilter ? elt.__zoom : d3.event.transform, // currently only used in trace

    deltaScale = 1 + deltaY/300,
    /** length of new domain. */
    newInterval = interval * deltaScale,
    rangeSize = range[1] - range[0];
    if (newInterval > domainSize) {
      console.log('limit newInterval', newInterval, domainSize);
      newInterval = domainSize;
    }

    newDomain = [
      // range[0] < rangeYCentre, so this first offset from centre is -ve
      centre + newInterval * (range[0] - rangeYCentre) / rangeSize,
      centre + newInterval * (range[1] - rangeYCentre) / rangeSize
    ];

    if (inFilter) {
        include = (newInterval > lowerZoom) && (newInterval <= (domainSize || 5e8));
    }

    // detect if domain is becoming flipped during zoom
    if ((newInterval < 0) || ((newInterval < 0) !== ((newDomain[1] - newDomain[0]) < 0)))
      console.log(domain, deltaScale, newInterval, newDomain);

    if (trace_zoom > 1)
      console.log(rangeYCentre, rangeSize, 'centre', centre);
    if (trace_zoom > 1)
      console.log(deltaY, deltaScale, transform, 'newInterval', newInterval, newDomain, include);
  }
  // if one (either) end of newDomain is outside axisReferenceDomain, set it to that limit
  if (! subInterval(newDomain, axisReferenceDomain))
  {
    console.log('! subInterval', newDomain, axisReferenceDomain);
    constrainInterval(newDomain, axisReferenceDomain);
    console.log('result of constrainInterval', newDomain);
  }


  return inFilter ? include : newDomain;
}

/*----------------------------------------------------------------------------*/

export { wheelNewDomain };
