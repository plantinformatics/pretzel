/*----------------------------------------------------------------------------*/

/** bundle chr data (incl markers) for draw-map:draw().
 * copy of Ember.RSVP.hash(promises).then(); factor these together.
 * @param c aka chrs[chr]
 */
function chrData(c) {
  /* factored from controllers/mapview.js, where it was originally developed. */

  let 
  /* rc aka retHash[chr] */
  rc  = {mapName : c.get('map').get('name'), chrName : c.get('name')};
  let workspaces = c.get('workspaces');
  let features = []
  workspaces.forEach(function(workspace) {
    workspace.get('features').forEach(function(feature) {
      features.push(feature)
    })
  })
  features.forEach(function(feature) {
    let markerName = feature.get('name');
    let markerPosition = feature.get('range')[0];
    rc[markerName] = {location: markerPosition, aliases: []};
  });
  console.log("chrData", rc);
  return rc;
}

/*----------------------------------------------------------------------------*/

export { chrData };
