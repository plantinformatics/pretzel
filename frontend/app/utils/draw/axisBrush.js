

// let  bbox  = { x: 1, y : 2, width: 20, height : undefined };

/** Add <clipPath><rect /><g clip-path= />
 * This is used within an axis to wrap the content of g.brush, provided a clip
 * rect for the brush elements.
 * @param gp  <g.brush>
 * @return selection of g[clip-path], used by the caller to insert the brush elements.
 */
function brushClip(gp, axisID) {

  let bbox = gp.node().parentElement.getBBox();
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

  console.log(axisID, bbox, 'brushClip', gp.node(), gprm.node(), gg.node(), g.node());

  return g;
}

export { brushClip };
