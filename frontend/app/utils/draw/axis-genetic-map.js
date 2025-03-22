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
 * @param qtlData array of {name, startPosition, endPosition}
 * @param chromosomeName  e.g. '2D'
 */
function drawGeneticMap(svg, markerData, qtlData, chromosomeName) {
    const width = 400, height = 800;
    const margin = { top: 50, right: 150, bottom: 50, left: 100 };

    /* const svg = d3.select("body").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    */
    svg = svg
        .append("g");

    // Scale for even spacing of markers along the axis
    const yScale = d3.scalePoint()
        .domain(markerData.map(d => d.name))
        .range([0, height])
        .padding(0.5);

    // Draw chromosome axis
    svg.append("line")
        .attr("x1", width / 2)
        .attr("x2", width / 2)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "black")
        .attr("stroke-width", 3);

    // Draw marker position text on the left-hand side
    svg.selectAll(".marker-position")
        .data(markerData)
        .enter().append("text")
        .attr("x", width / 2 - 30)
        .attr("y", d => yScale(d.name) + 5)
        .text(d => d.position)
        .attr("font-size", "12px")
        .attr("text-anchor", "end");

    // Draw marker connectors (LHS)
    svg.selectAll(".marker-line-left")
        .data(markerData)
        .enter().append("line")
        .attr("x1", width / 2 - 25)
        .attr("x2", width / 2 - 5)
        .attr("y1", d => yScale(d.name))
        .attr("y2", d => yScale(d.name))
        .attr("stroke", "black")
        .attr("stroke-width", 1);

    // Draw marker connectors (RHS)
    svg.selectAll(".marker-line-right")
        .data(markerData)
        .enter().append("line")
        .attr("x1", width / 2 + 5)
        .attr("x2", width / 2 + 25)
        .attr("y1", d => yScale(d.name))
        .attr("y2", d => yScale(d.name))
        .attr("stroke", "black")
        .attr("stroke-width", 1);

    // Draw marker labels
    svg.selectAll(".marker-label")
        .data(markerData)
        .enter().append("text")
        .attr("x", width / 2 + 30)
        .attr("y", d => yScale(d.name) + 5)
        .text(d => d.name)
        .attr("font-size", "12px");

    // Draw QTL regions
    svg.selectAll(".qtl")
        .data(qtlData)
        .enter().append("rect")
        .attr("x", width / 2 - 10)
        .attr("y", d => yScale(d.startMarker))
        .attr("width", 20)
        .attr("height", d => yScale(d.endMarker) - yScale(d.startMarker))
        .attr("fill", d => d.color === "Red" ? "#e1321f" : "#2f2c57")
        .attr("opacity", 0.6);

    // QTL Labels with improved transform
    svg.selectAll(".qtl-label")
        .data(qtlData)
        .enter().append("text")
        .attr("x", 0)
        .attr("y", 0)
        .attr("transform", d => `rotate(-90) translate(-${(yScale(d.startMarker) + yScale(d.endMarker)) / 2}, ${width / 2 + 50})`)
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
