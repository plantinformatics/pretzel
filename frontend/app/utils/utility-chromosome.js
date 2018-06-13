import { breakPoint } from '../utils/breakPoint';

/*----------------------------------------------------------------------------*/

/** bundle chr data (incl features) for draw-map:draw().
 * copy of Ember.RSVP.hash(promises).then(); factor these together.
 * @param c aka chrs[chr]
 */
function chrData(c) {
  /* factored from controllers/mapview.js, where it was originally developed. */

  let 
    map = c.get('datasetId'),  // replaces c.get('map'),
  /* rc aka retHash[chr] */
  rc  = {mapName : map.get('name'), chrName : c.get('name')
         /* , scope : c.get('scope'), featureType : c.get('featureType')
         , namespace: map.namespace, */ , dataset : map
        };
  ['range', 'featureType', 'scope'].forEach(function (fieldName) {
  if (c.get(fieldName))
    rc[fieldName] = c.get(fieldName);
  });

  let f = c.get('features');
  f.forEach(function(feature) {
    let featureName = feature.get('name');
    /** range should be defined and be an array, but this will handle a mix of
     * data from other source versions without exception.
     *
     * Also field name is changing feature.range <-> .value
     * Current data is mixed format  :
     * from pretzel-data [develop] : myMap.json has value [0, 0] and 
     * public_maps/json/pbi0012-0787-SD23.fixed.json has range [0]
     */
    let range = feature.get('value') || feature.get('range'),
    featurePosition = range && range[0];
    let featureAliases = feature.get('aliases');  // feature.aliases field is removed from db
    let featureId = feature.get('id');
    if (featurePosition === undefined)
      breakPoint('chrData', c, map, rc, f, feature, range, featurePosition, featureAliases, featureId);
    rc[featureName] = {location: featurePosition, aliases: featureAliases, id: featureId};
    if (!range) console.log("chrData range", featureName, rc[featureName]);
  });
  console.log("chrData", rc);
  return rc;
}

/*----------------------------------------------------------------------------*/

export { chrData };
