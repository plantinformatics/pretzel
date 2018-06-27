
import { highlightId } from '../../utils/draw/axis';

/*------------------------------------------------------------------------------*/

/* global d3 */

/*----------------------------------------------------------------------------*/

/** indicative, not used.
*/
function highlightFeature_drawFromParams(component)
{
    let highlightFeature = component.get(/*model.params.*/ 'highlightFeature');
    if (highlightFeature)
    {
      console.log("highlightFeature", highlightFeature);
      highlightFeature_draw(highlightFeature);
    }
}
/*------------------------------------------------------------------------------*/

/** Draw a text box to highlight a Feature.
 *
 * This was created to create a text annotation of a single feature in a Pretzel
 * diagram for a paper in preparation.
 * This could be used as is, or converted to .hbs.
 * This doesn't have the ability to draw a line connecting the text box with the
 * feature; that was to be added in another graphic application.
 */
function highlightFeature_draw(highlightFeature)
{
    if (highlightFeature)
    {
    //Setup the gene / feature highlight, enabled by url param highlightFeature.
    let highlightFeatureS =
      d3.select('#holder').selectAll(".highlightFeature")
      .data([highlightFeature])
      .enter().append("div")
      .attr("class", "highlightFeature")
      .attr("id", highlightId);

    // let hmPos = [20, 500];
    highlightFeatureS.html(highlightFeature)
      // .style("left", "" + hmPos[0] + "px")             
      .style("top", "" + '44%'); // hmPos[1] + "px"

      if (! highlightFeatureS.empty())
        console.log('highlightFeature_draw', highlightFeatureS.node());
    }
}

/*------------------------------------------------------------------------------*/

export { highlightFeature_drawFromParams };
