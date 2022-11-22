import { computed } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import Evented from '@ember/object/evented';
import { A } from '@ember/array';


import { intersection } from 'lodash/array';

import { contentOf } from '../../utils/common/promises';


const dLog = console.debug;

const trace = 1;

/**
 * for #223 : Selections and defining intervals 
 */
export default Service.extend(Evented, {

  // ---------------------------------------------------------------------------

  /** Selected features, in a single array
   */

  /** array of {Chromosome, Feature, Position, feature}.
   * selectedBlocksFeaturesToArray() returns this form.
   */
  selectedFeatures : [],

  /** Selected features, grouped in per-block arrays.
   * [blockId] -> [feature, ...]
   * This is operated on by :
   *  selectedFeatures_add(), selectedFeatures_clear(),
   *  selectedBlocksFeaturesToArray(),
   *  removeUnviewedBlockFeaturesFromSelected()
   * The result of selectedBlocksFeaturesToArray() can be written to .selectedFeatures with updateSelectedFeatures.
   */
  blocksFeatures : {},

  // ---------------------------------------------------------------------------

  /** blocks of .selectedFeatures */
  selectedAxes : [],

  // ---------------------------------------------------------------------------

  selectedElements : A(),

  // ---------------------------------------------------------------------------

  /** clicked features or the feature search results;  shown as
   * triangles.
   * features not feature names.  
   * After feature search, the feature search result is copied to .features.
   */
  features : A(),

  /** shift-clicked features, i.e. triangles (.features) which have been shift-clicked on.
   * features not feature names.  
   * After feature search, .shiftClickedFeatures will be intersected with the feature search result.
   * subset of .features.
   */
  shiftClickedFeatures : A(),

  /** triangles which were clicked
   * After feature search, labelledFeatures will be intersected with the feature search result.
   */
  labelledFeatures : A(),

  // ---------------------------------------------------------------------------
  /** Operations on .features, .shiftClickedFeatures, .labelledFeatures */

  /** Called when an axis feature track or feature triangle is clicked.
   * Toggle membership of the feature in one of the arrays : .features or .labelledFeatures
   *
   * Signal event toggleFeature(feature, added, listName)
   * This event is published here rather than in the component which receives
   * the click (axis-tracks : clickTrack) because the feature 'clicked' status
   * resides here.
   *
   * @param add undefined or boolean : if true then add, if false then remove
   */
  toggle(listName, feature, add) {
    let
    features = this.get(listName),
    i = features && features.indexOf(feature);
    if (! features || trace /*> 1*/) {
      dLog('clickFeature', listName, i, feature, features);
    }
    /** indicates that the feature was initially not in the list. */
    let absent = i === -1;
    /** true / false indicates that the feature was added/removed to/from the list.
     * undefined indicates no change.
     */
    let added;
    if (absent && (add !== false)) {
      features.pushObject(feature);
      added = true;
    } else if (! absent && (add !== true)) {
      features.removeAt(i, 1);
      if (listName === 'features') {
	/** clearing from .features is required to clear from the other 2 lists;
	 * it is starting to look like using a single list .features and flags
	 * feature.{isShiftClicked,isLabelled} would be neater.  (then also have
	 * to clear the flags when removed from .features so that they don't
	 * appear to be labelled or shiftClicked when re-added to .features
	 * later)
	 */
	this.labelledFeatures.removeObject(feature);
	this.shiftClickedFeatures.removeObject(feature);
      }
      added = false;
    }
    if (added !== undefined) {
      this.trigger('toggleFeature', feature, added, listName);
    }
  },
  clickFeature(feature) {
    this.toggle('features', feature);
  },
  shiftClickFeature(feature) {
    this.toggle('shiftClickedFeatures', feature);
  },
  /** user has clicked on the triangle, so draw a text label. */
  clickLabel(feature) {
    this.toggle('labelledFeatures', feature);
  },

  /*--------------------------------------------------------------------------*/
  /** Receive the results of Feature Search.
   * This effects .features, .labelledFeatures, .shiftClickedFeatures.
   */
  featureSearchResult(features) {
    dLog('featureSearchResult', features.length, this.shiftClickedFeatures.length);
    let filteredFeatures = intersection(this.shiftClickedFeatures, features);
    dLog('featureSearchResult', filteredFeatures.length);
    this.set('shiftClickedFeatures', filteredFeatures);
    // similarly for .labelledFeatures
    this.set('labelledFeatures', intersection(this.labelledFeatures, features));
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
          map.set(key, a = A());
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
        (feature) => contentOf(feature.get('blockId')));
    return features;
  }),
  clickedFeaturesByAxis : computed('features.[]', function () {
    let
    features = 
      this.groupFeatures(
        'clickedFeaturesByAxis', 'features',
        (feature) => feature.get('blockId.referenceBlockOrSelf'));
    return features;
  }),

  shiftClickedFeaturesByBlock : computed('shiftClickedFeatures.[]', function () {
    let
    features = 
      this.groupFeatures(
        'shiftClickedFeaturesByBlock', 'shiftClickedFeatures',
        (feature) => contentOf(feature.get('blockId')));
    return features;
  }),
  shiftClickedFeaturesByAxis : computed('shiftClickedFeatures.[]', function () {
    let
    features = 
      this.groupFeatures(
        'shiftClickedFeaturesByAxis', 'shiftClickedFeatures',
        (feature) => feature.get('blockId.referenceBlockOrSelf'));
    return features;
  }),


  labelledFeaturesByBlock : computed('labelledFeatures.[]', function () {
    let
    features = 
      this.groupFeatures(
        'labelledFeaturesByBlock', 'labelledFeatures',
        (feature) => contentOf(feature.get('blockId')));
    return features;
  }),
  labelledFeaturesByAxis : computed('labelledFeatures.[]', function () {
    let
    features = 
      this.groupFeatures(
        'labelledFeaturesByAxis', 'labelledFeatures',
        (feature) => feature.get('blockId.referenceBlockOrSelf'));
    return features;
  }),

  /*--------------------------------------------------------------------------*/
  /** Operations on .blocksFeatures */

  updateSelectedFeatures: function(features) {
    const fnName = 'updateSelectedFeatures';
    const
    selectedSummary =
      Object.entries(features).map(([mapChrName, features]) => [mapChrName, features.length]);
    console.log(fnName, selectedSummary);
    if (this.blocksFeatures !== features) {
      this.set('blocksFeatures', features);
    }
  },

  selectedFeatures_add(mapChrName, feature) {
    this.blocksFeatures[mapChrName].push(feature);
  },

  selectedFeatures_clear()
  {
    if (this.selectedFeatures.length) {
      this.selectedFeatures.removeAt(0, this.selectedFeatures.length);
    }

    const selectedFeatures = this.blocksFeatures;
    /* delete properties instead of '= {}'
     * to preserve the reference
     */
    for (const mapChrName in selectedFeatures){
      if (selectedFeatures.hasOwnProperty(mapChrName)) {
        delete selectedFeatures[mapChrName];
      }
    }
    // no-op because selectedFeatures reference has not changed.
    this.updateSelectedFeatures(selectedFeatures);
  }


  //----------------------------------------------------------------------------

});

//------------------------------------------------------------------------------

function selectedBlocksFeaturesToArray(selectedFeatures) {
  const
  featuresAsArray = Object.keys(selectedFeatures)
    .map(function (key) {
      return selectedFeatures[key].map(function(feature) {
        /** feature is now the Ember object models/feature 
         * Until 0eeda0a7, feature contained feature name and position, separated by " ".
         */
        let selectedFeature = {
          Chromosome : key,
          Feature : feature.name,
          Position : feature.location, /* i.e. .value[0]*/
          /** Chromosome, Feature and Position can be derived from
           * feature, so after the various uses of this are
           * changed to use .feature, the structure can be
           * replaced by simply feature.
           */
          feature
        };
        return selectedFeature;
      });
    })
    .reduce(function(a, b) { 
      return a.concat(b);
    }, []);

  return featuresAsArray;
}

//------------------------------------------------------------------------------

export {
  selectedBlocksFeaturesToArray,
};

//------------------------------------------------------------------------------
