
/* global d3 */

/*----------------------------------------------------------------------------*/
const trace_zoom = 2;
/*----------------------------------------------------------------------------*/

/**
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
    /** looks like .sourceEvent is defined in zoom(); whereas in zoomFilter() d3.event.deltaY works. */
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
      // copied from draw-map.js
      function inRange(a, range)
      {
        return range[0] <= a && a <= range[1];
      }
      // use `some` so that search completes as soon as one value is found out of range.
      include = ! newDomain.some(function (d) { return ! inRange(d, axisReferenceDomain); });
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

    deltaScale = 1 + deltaY/300,
    /** length of new domain. */
    newInterval = interval * deltaScale,
    rangeSize = range[1] - range[0];
    newDomain = [
      // range[0] < rangeYCentre, so this first offset from centre is -ve
      centre + newInterval * (range[0] - rangeYCentre) / rangeSize,
      centre + newInterval * (range[1] - rangeYCentre) / rangeSize
    ];

    if (inFilter) {
        include = (newInterval > lowerZoom) && (newInterval < (domainSize || 5e8));
    }

    // detect if domain is becoming flipped during zoom
    if ((newInterval < 0) || ((newInterval < 0) !== ((newDomain[1] - newDomain[0]) < 0)))
      console.log(domain, deltaScale, newInterval, newDomain);

    if (trace_zoom > 1)
      console.log(rangeYCentre, rangeSize, 'centre', centre);
    if (trace_zoom > 1)
      console.log(deltaY, deltaScale, 'newInterval', newInterval, newDomain, include);
  }


  return inFilter ? include : newDomain;
}

/*----------------------------------------------------------------------------*/

export { wheelNewDomain };
