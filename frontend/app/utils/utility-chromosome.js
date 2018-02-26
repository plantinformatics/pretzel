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
  let m = c.get('features');
  m.forEach(function(marker) {
    let markerName = marker.get('name');
    let markerPosition = marker.get('range')[0];
    let markerAliases = marker.get('aliases');
    rc[markerName] = {location: markerPosition, aliases: markerAliases};
  });
  console.log("chrData", rc);
  return rc;
}

/*----------------------------------------------------------------------------*/

export { chrData };
