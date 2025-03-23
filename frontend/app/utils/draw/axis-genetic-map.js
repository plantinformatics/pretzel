/* global d3 */

export { drawGeneticMap }
/** Generate a old-style genetic map 
 * like e.g.
 * https://www.wur.nl/en/show/mapchart.htm
 * https://molhort.biomedcentral.com/articles/10.1186/s43897-021-00020-x
 *   MG2C: a user-friendly online tool for drawing genetic maps
 *
 * Initially based on : https://chatgpt.com/canvas/shared/67d947b49a188191a352866af71b4a3c
 *
 * @param svg <svg> or <g> within it, i.e. svgContainer
 * @param markerData  array of {name, position}, from features
 * Sorted in ascending order by .position.
 * @param qtlData array of {name, startPosition, endPosition}
 * @param chromosomeName  e.g. '2D'
 */
function drawGeneticMap(svg, markerData, qtlData, chromosomeName) {
    /** Height of the text rows */
    const textHeight = markerData.length * 16;
    /** Axes drawn by MapChart seem to be generally shorter than the text,
     * with no clear pattern - probably adjusted by the user to suit the number of markers.
     */
    const axisLength = textHeight;

    const width = 400, height = textHeight; // was 800
    const margin = { top: 50, right: 150, bottom: 50, left: 100 };

    /* currently markerData is sorted in the caller for use in QTL data setup
     *   markerData = markerData.sortBy('position');
     */

    /* const svg = d3.select("body").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    */
    svg = svg
        .append("g");

  // Scale for marker positions, i.e. centiMorgan axis position.
    const yScale = d3.scaleLinear()
        .domain(d3.extent(markerData, d => d.position))
        .range([0, height]);

    // Scale for even spacing of markers along the axis
    // i.e. to display marker position text and name text as evenly-spaced rows,
    // as in a spreadsheet.
    const yScaleEven = d3.scalePoint()
        .domain(markerData.map(d => d.name))
        .range([0, height])
        .padding(0.5);

    // Draw chromosome axis
    svg.append("rect")
        .attr("x", (width - 10) / 2)
        .attr("width", 10)
        .attr("y", 0)
        .attr("height", height)
        .attr("stroke", "black")
        .attr("fill", "green")
        .attr("stroke-width", 1);

    // Draw marker position text on the left-hand side
    svg.selectAll(".marker-position")
        .data(markerData)
        .enter().append("text")
        .attr("x", width / 2 - 30)
        .attr("y", d => yScaleEven(d.name) + 5)
        .text(d => d.position)
        .attr("font-size", "12px")
        .attr("text-anchor", "end");

    // Draw marker connectors (LHS)
    svg.selectAll(".marker-line-left")
        .data(markerData)
        .enter().append("line")
        .attr("x1", width / 2 - 25)
        .attr("x2", width / 2 - 5)
        .attr("y1", d => yScaleEven(d.name))
        .attr("y2", d => yScale(d.position))
        .attr("stroke", "black")
        .attr("stroke-width", 1);

    // Draw marker connectors (RHS)
    svg.selectAll(".marker-line-right")
        .data(markerData)
        .enter().append("line")
        .attr("x1", width / 2 + 5)
        .attr("x2", width / 2 + 25)
        .attr("y1", d => yScale(d.position))
        .attr("y2", d => yScaleEven(d.name))
        .attr("stroke", "black")
        .attr("stroke-width", 1);

    // Draw marker labels
    svg.selectAll(".marker-label")
        .data(markerData)
        .enter().append("text")
        .attr("x", width / 2 + 30)
        .attr("y", d => yScaleEven(d.name) + 5)
        .text(d => d.name)
        .attr("font-size", "12px");

    // Draw QTL regions
    svg.selectAll(".qtl")
        .data(qtlData)
        .enter().append("rect")
        .attr("x", (width - 10) / 2)
        .each(qtlRect);

      function qtlRect(d, i, g) {
        const
        r = d3.select(this);
        r
        .attr("y", d => yScale(d.startPosition))
        .attr("width", 10)
        .attr("height", d => yScale(d.endPosition) - yScale(d.startPosition))
        .attr("fill", d => d.color === "Red" ? "#e1321f" : "#2f2c57")
        .attr("opacity", 0.6);
      }

    /** left edge of QTL area. */
    const qtlLeft = 150;

    // Draw a mirror of QTL regions, beside the QTL text, to refer to the QTL region in the axis.
    svg.selectAll(".qtl-mirror")
        .data(qtlData)
        .enter().append("rect")
        .attr("x", d => width / 2 + qtlLeft + d.layer * 50)
        .each(qtlRect);

    // QTL Labels with improved transform
    svg.selectAll(".qtl-label")
        .data(qtlData)
        .enter().append("text")
        .attr("x", 0)
        .attr("y", 0)
        .attr("transform", d => `rotate(-90) translate(-${(yScale(d.startPosition) + yScale(d.endPosition)) / 2}, ${width / 2 + qtlLeft + 20 + d.layer * 50})`)
        .text(d => d.name)
        .attr("fill", d => d.color === "Red" ? "#e1321f" : "#2f2c57")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle");

    // Chromosome name
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -20)
        .text(chromosomeName)
        .attr("font-size", "18px")
        .attr("font-weight", "bold")
        .attr("text-anchor", "middle");
}
