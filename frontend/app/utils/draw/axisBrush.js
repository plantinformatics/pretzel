import { yAxisBtnScale, eltId, axisFeatureCircles_selectAll  }  from './axis';
import { I } from './d3-svg';


/* global d3 */

const dLog = console.debug;

// let  bbox  = { x: 1, y : 2, width: 20, height : undefined };

/** Add <clipPath><rect /><g clip-path= />
 * This is used within an axis to wrap the content of g.brush, provided a clip
 * rect for the brush elements.
 * @param gp  <g.brush>
 * @return selection of g[clip-path], used by the caller to insert the brush elements.
 */
function brushClip(gp, axisID) {

  let gpp = gp.node().parentElement;

  // there may be a delay before getBBox is available.  if so, return an empty selection.
  if (! gpp.getBBox)
    return d3.select(undefined);

  let bbox = gpp.getBBox();

  /** datum is axisID, so id and clip-path could be functions. */
  let axisClipId = "axis-clip-" + axisID;

  let
    gc = gp.selectAll("g > clipPath")
    .data([axisID]),
  gr = gc.enter()
  // define the clipPath
    .append("clipPath")       // define a clip path
    .attr("id", axisClipId) // give the clipPath an ID
    .append("rect"),          // shape it as a rect
  gprm = gp.selectAll("clipPath > rect")
    .attr("x", bbox.x)
    .attr("y", bbox.y + 30)
    .attr("width", bbox.width)
    .attr("height", bbox.height - 30)
  ;
  let gg = 
    gp.selectAll("g > [clip-path]"),
  g = gg
    .data([axisID])
    .enter()
    .append("g")
    .attr("clip-path", "url(#" + axisClipId + ")") // clip with the rectangle
    .merge(gg);

  dLog(axisID, bbox, 'brushClip', gp.node(), gprm.node(), gg.node(), g.node());

  return g;
}

/*--------------------------------------------------------------------------*/


function showAxisZoomResetButtons(svgContainer, getBrushExtents, zoom, resetZoom, brushedAxisID, drawMap) {
  /** d3 selection of the brushed axis. */
  let axisS = svgContainer.selectAll("#" + eltId(brushedAxisID));
  /** this is the element which is passed when called via
   * zoomBehavior.on('zoom', zoom)
   * so pass the same element when calling via g.btn .Zoom .on('click' ).
   */
  let that = axisS.selectAll('g.brush > g[clip-path]').node();
  let zoomResetNames = ['Zoom', 'Reset'];
  let gS = axisS
      .selectAll('g.btn')
      .data([1]);
  let gE = gS
      .enter()
      .append('g')
      .attr('class', 'btn');
  gE
    .selectAll('rect')
    .data(zoomResetNames)
    .enter()
    .append('rect')
    .attr('class', (d,i) => zoomResetNames[i]);
  let g = gS.merge(gE);
  g
    .attr('transform', yAxisBtnScale);
  gE
      .selectAll('text')
      .data(zoomResetNames)
      .enter()
      .append('text')
      .attr('class', (d,i) => zoomResetNames[i])
      .attr('x', (d,i) => i*55).attr('y', 20)
      .text(I);
  g.on('mousedown', function () {
    d3.event.stopPropagation();
  });
  /** parallel with zoomResetNames[], [0] is Zoom and [1] is Reset. */
  g
    .selectAll('.Zoom')
    .on('click', function () {
      d3.event.stopPropagation();
      let brushExtents = getBrushExtents();
      zoom(that,brushExtents);
      // zoomed = true; // not used.

      //reset function
      //Remove all the existing circles
      axisFeatureCircles_selectAll().remove();

    });
  let
  resetSwitch = g.selectAll('.Reset');
  resetSwitch
    .on('click',function(){resetZoom(brushedAxisID); });
 
 dLog("showAxisZoomResetButtons g", g.nodes());
}


/*--------------------------------------------------------------------------*/



export { brushClip, showAxisZoomResetButtons };
