import { computed } from '@ember/object';
import Service, { inject as service } from '@ember/service';


const dLog = console.debug;

/**
 * for #223 : Selections and defining intervals 
 */
export default Service.extend({

  /** clicked features, not all the feature search results (which are shown as
   * triangles also).
   * features not feature names.  
   * After feature search, .features will be intersected with the feature search result.
   */
  features : Ember.A(),

  /** triangles which were clicked
   * After feature search, labelledFeatures will be intersected with the feature search result.
   */
  labelledFeatures : Ember.A(),

  /** Called when an axis feature track or feature triangle is clicked.
   * Toggle membership of the feature in one of the arrays : .features or .labelledFeatures
   */
  toggle(listName, feature) {
    let
    features = this.get(listName),
    i = features.indexOf(feature);
    dLog('clickFeature', listName, i, feature, features);
    if (i === -1) {
      features.pushObject(feature);
    } else {
      features.removeAt(i, 1);
    }
  },
  clickFeature(feature) {
    this.toggle('features', feature);
  },
  clickLabel(feature) {
    this.toggle('labelledFeatures', feature);
  },

  /*--------------------------------------------------------------------------*/
  /* Show triangles for the features in the array : clicked features   */

  /** Group the clicked or labelled features so they can be looked up by axis reference block
   * or by data block.
   */
  groupFeatures(callerName, fieldName, groupFn) {
    let
    features = this.get(fieldName).reduce(
      function (map, feature)
      {
        let key = groupFn(feature),
            a = map.get(key);
        if (! a) {
          map.set(key, a = Ember.A());
        }
        a.pushObject(feature);
        return map;
      },
      new Map()
    );
    dLog(callerName, features, this.features);
    return features;
  },
  clickedFeaturesByBlock : computed('features.[]', function () {
    let
    features = 
      this.groupFeatures(
        'clickedFeaturesByBlock', 'features',
        (feature) => feature.get('blockId.content') || feature.get('blockId'));
    return features;
  }),
  clickedFeaturesByAxis : computed('features.[]', function () {
    let
    features = 
      this.groupFeatures(
        'clickedFeaturesByAxis', 'features',
        (feature) => feature.get('blockId.referenceBlock'));
    return features;
  }),

  labelledFeaturesByBlock : computed('labelledFeatures.[]', function () {
    let
    features = 
      this.groupFeatures(
        'labelledFeaturesByBlock', 'labelledFeatures',
        (feature) => feature.get('blockId.content') || feature.get('blockId'));
    return features;
  }),
  labelledFeaturesByAxis : computed('labelledFeatures.[]', function () {
    let
    features = 
      this.groupFeatures(
        'labelledFeaturesByAxis', 'labelledFeatures',
        (feature) => feature.get('blockId.referenceBlock'));
    return features;
  }),

  /*--------------------------------------------------------------------------*/

});
