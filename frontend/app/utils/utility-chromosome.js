/*----------------------------------------------------------------------------*/

/** bundle chr data (incl features) for draw-map:draw().
 * copy of Ember.RSVP.hash(promises).then(); factor these together.
 * @param c aka chrs[chr]
 */
function chrData(c) {
  /* factored from controllers/mapview.js, where it was originally developed. */

  let 
  /* rc aka retHash[chr] */
  rc  = {mapName : c.get('map').get('name'), chrName : c.get('name')};
  let f = c.get('features');
  f.forEach(function(feature) {
    let featureName = feature.get('name');
    let featurePosition = feature.get('range')[0];
    let featureAliases = feature.get('aliases');
    rc[featureName] = {location: featurePosition, aliases: featureAliases};
  });
  console.log("chrData", rc);
  return rc;
}

/*----------------------------------------------------------------------------*/

export { chrData };
