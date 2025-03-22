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

    // Scale for marker positions
    const yScale = d3.scaleLinear()
        .domain(d3.extent(markerData, d => d.position))
        .range([0, height]);

    // Draw chromosome axis
    svg.append("line")
        .attr("x1", width / 2)
        .attr("x2", width / 2)
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "black")
        .attr("stroke-width", 3);

    // Draw markers
    svg.selectAll(".marker")
        .data(markerData)
        .enter().append("circle")
        .attr("cx", width / 2)
        .attr("cy", d => yScale(d.position))
        .attr("r", 4)
        .attr("fill", "black");

    // Draw marker labels
    svg.selectAll(".marker-label")
        .data(markerData)
        .enter().append("text")
        .attr("x", width / 2 + 10)
        .attr("y", d => yScale(d.position) + 5)
        .text(d => d.name)
        .attr("font-size", "12px");

    // Draw QTL regions
    svg.selectAll(".qtl")
        .data(qtlData)
        .enter().append("rect")
        .attr("x", width / 2 - 10)
        .attr("y", d => yScale(d.startPosition))
        .attr("width", 20)
        .attr("height", d => yScale(d.endPosition) - yScale(d.startPosition))
        .attr("fill", d => d.color === "Red" ? "#e1321f" : "#2f2c57")
        .attr("opacity", 0.6);

    // QTL Labels
    svg.selectAll(".qtl-label")
        .data(qtlData)
        .enter().append("text")
        .attr("x", width / 2 + 50)
        .attr("y", d => (yScale(d.startPosition) + yScale(d.endPosition)) / 2)
        .text(d => d.name)
        .attr("fill", d => d.color === "Red" ? "#e1321f" : "#2f2c57")
        .attr("font-size", "14px")
        .attr("font-weight", "bold")
        .attr("transform", "rotate(-90)")
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
