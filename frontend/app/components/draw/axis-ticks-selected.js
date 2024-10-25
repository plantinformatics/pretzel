import { debounce, throttle, bind as run_bind } from '@ember/runloop';
import { computed, observer } from '@ember/object';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { on } from '@ember/object/evented';

import { task, timeout, didCancel } from 'ember-concurrency';

import AxisEvents from '../../utils/draw/axis-events';
import { transitionEndPromise } from '../../utils/draw/d3-svg';
import { arraysConcat } from '../../utils/common/arrays';

/* global d3 */

const trace = 0;
const dLog = console.debug;

const CompName = 'components/axis-ticks-selected';

/*----------------------------------------------------------------------------*/
/** @return true if feature's block is not viewed and its dataset
 * has tag transient.
 */
function featureIsTransient(f) {
  let isTransient = ! f.get('blockId.isViewed');
  if (isTransient) {
    let d = f.get('blockId.datasetId');
    d = d.get('content') || d;
    isTransient = d.hasTag('transient');
  }
  return isTransient;
}


/*----------------------------------------------------------------------------*/



/** Display horizontal ticks on the axis to highlight the position of features
 * found using Feature Search.
 *
 * @param featuresInBlocks results of Feature Search; a lookup function for these
 * is passed to showTickLocations()
 */
export default Component.extend(AxisEvents, {
  selected : service('data/selected'),
  controls : service(),

  
  resized : function(widthChanged, heightChanged, useTransition) {
    /* useTransition could be passed down to showTickLocations()
     * (also could pass in duration or t from showResize()).
     */
    if (trace)
      dLog("resized in ", CompName);
    if (heightChanged)
      this.renderTicksThrottle();
  },

  /** axis-ticks-selected receives axisStackChanged and zoomedAxis from axis-1d,
   * which filters zoomedAxis events for by axisID.  axisStackChanged events are
   * not specific to an axisID.
   */

  /** draw-map:axisStackChanged_(t) sends transition t. */
  axisStackChanged : function() {
    /** when zoom & reset button, axisStackChanged arrives after other
     * dependency changes (zoomedDomain), and interrupts the transition they
     * started.
     * The role of axisStackChanged is probably supplanted by other, more
     * direct, dependencies added since.  Testing hasn't yet shown missing updates.
     */
    if (false) {
    if (trace)
      dLog("axisStackChanged in ", CompName);
    /* draw-map : axisStackChanged() / axisStackChanged_() already does throttle. */
    this.renderTicks();
    }
  },

  /** @param [axisID, t] */
  zoomedAxis : function(axisID_t) {
  },

  /** Render elements which are dependent on axis scale - i.e. the axis ticks.
   */
  axisScaleEffect : observer('axis1d.domainChanged', function () {
    let axisScaleChanged = this.get('axis1d.domainChanged');
    let axisID = this.get('axisId');
    // if (trace)
    dLog('axisScaleChanged', axisID, this.get('axis.id'), axisScaleChanged, this.axis1d.scaleChanged && this.axis1d.scaleChanged.domain());
    this.renderTicks/*Throttle*/(axisID);
    /** somehow renderTicks() is missing the latest scale.  redrawing after a
     * delay gets the correct scale, so the next step would be to trace the axis
     * scale in render to confirm that.
     */
    const reRenderLater = () => { this.renderTicksThrottle(axisID); };
    debounce(reRenderLater, 750);

    return true;
  }),

  /** Re-render when the number of selected / shiftClicked / labelled Features changes.
   */
  selectedFeaturesEffect : computed(
    'selected.selectedFeatures.length',
    'selected.shiftClickedFeatures.length',
    'selected.labelledFeatures.length',
    'selected.features.length',
    'axis1d.blocks.length',
    function () {
      this.renderTicksThrottle();
    }),

  didRender() {
    this._super.apply(this, arguments);

    let featuresInBlocks = this.get('featuresInBlocks');
    if (trace)
      dLog('didRender', featuresInBlocks, this.get('axisId'),
           'axis1d ', this.get('axis1d'));
    this.renderTicksThrottle();
  },

  renderTicks(axisID) {
    if (trace)
      dLog("renderTicks in ", CompName, axisID);
    let
    axis1d = this.get('axis1d'),
    featureTicks = axis1d.get('featureTicks');
    if (! axis1d.isDestroying && featureTicks) {
    let block = axis1d.axis,
    clickedFeaturesMap = this.get('selected.clickedFeaturesByAxis'),
    /** clickedFeatures will be undefined or an array with .length > 1
     *
     * clickedFeaturesByBlock are included by featuresOfBlockLookup();
     * call that for data blocks if clickedFeaturesByAxis is not empty .
     */
    clickedFeatures = clickedFeaturesMap && clickedFeaturesMap.get(block);
    // if ((featuresInBlocks[blockId] for any of the axis' data blocks) || clickedFeatures) {
      featureTicks.showTickLocations(
      this.featuresOfBlockLookup.bind(this),
      false,  /* hover text not required on axis feature triangles. */
      'foundFeatures', true,
      this.clickTriangle.bind(this)        
      );

    featureTicks.showSpanningLine(this.selectedFeaturesOfBlockLookup.bind(this, 'shiftClickedFeatures'));
    // currently called via didRender(), so ticks and labels are both updated.
    this.renderLabels(axisID);
    }
  },
  renderLabels(axisID) {
    let
    axis1d = this.get('axis1d'),
    featureTicks = axis1d.get('featureTicks');
    let
    block = axis1d.axis;
    /** if this block had labelledFeatures, and in this update they (1) are
     * toggled off, then labelledFeatures is undefined, but we still want to
     * call showLabels() to .remove() the existing <text>-s.
     */
    // labelledFeatures = this.get('selected.labelledFeaturesByAxis').get(block);
    /* if (labelledFeatures) */ {
      featureTicks.showLabels(
        this.selectedFeaturesOfBlockLookup.bind(this, 'labelledFeatures'),
        true,
        'labelledFeatures', false,
        run_bind(this, this.labelsTransitionPerform),
      );
    }
  },
  labelsTransitionPerform(transition, callFn) {
    if (true) {
      transition.call(callFn);
    } else {
    this.labelsTransitionTask.perform(transition, callFn)
      .catch(run_bind(this, this.ignoreCancellation))
      .finally(() => dLog('labelsTransitionTask', 'finally'));
    }
  },
  labelsTransitionTask : task(function * (transition, callFn) {
    let promise;
    if (! transition.size()) {
      promise = Promise.resolve();
    } else {
      transition.call(callFn);
      promise = transitionEndPromise(transition);
    }
    return promise;
  }).drop(),
  /** Recognise if the given task error is a TaskCancelation.
   */
  ignoreCancellation(error) {
    // based on similar in drawCurrentTask() (draw/block-adj.js) etc
    if (! didCancel(error)) {
      dLog('axis-ticks-selected', 'taskInstance.catch', this.axisId, error);
      throw error;
    }
  },
  /** call renderTicks().
   * filter / throttle the calls to handle multiple events at the same time.
   * @param axisID  undefined, or this.get('axisId') (not required or used);
   * undefined when called from axisStackChanged().
   *
   * (earlier versions called this from zoomedAxis(), which passed [axisID,
   * transition], so that transition length could be consistent for an event
   * across multiple components; axisStackChanged() can pass the transition,
   * although showTickLocations() does not (yet) use it.)
   */
  renderTicksThrottle(axisID) {
    if (trace)
      dLog('renderTicksThrottle', axisID);

    /* see comments in axis-1d.js : renderTicksDebounce() re. throttle versus debounce */
    /* pass immediate=false - gives time for clickedFeaturesByAxis to
     * be changed by transient.showFeatures().  Could address this with
     * a dependency on selected.clickedFeaturesByAxis
     */
    throttle(this, this.renderTicks, axisID, 500, false);
  },

  /** Lookup the given block in featuresInBlocks, and return its features which
   * were in the featureSearch result.
   * @param block Ember object
   */
  featuresOfBlockLookup(block) {
    /** now that feature search result is copied to selected.features, it is not
     * required to display ticks (triangles) for the feature search result
     * (featuresInBlocks).
     */
    const showSearchResult = false;
    /** features found by goto-feature-list, indexed by block id. */
    let featuresInBlocks = showSearchResult && this.get('featuresInBlocks');
    let blockId = block.get('id');
    /** return [] for blocks which don't have features in the search result. */
    let features = featuresInBlocks ? (featuresInBlocks[blockId] || []) : [];
    let clickedFeaturesByBlock = this.get('selected.clickedFeaturesByBlock'),
        clickedFeatures = clickedFeaturesByBlock && clickedFeaturesByBlock.get(block);
    if (clickedFeatures && clickedFeatures.length) {
      features = features.concat(clickedFeatures);
    }
    let transientFeatures = this.transientFeaturesLookup(block, 'clickedFeatures');
    features = arraysConcat(features, transientFeatures);

    if (trace)
      dLog('featuresOfBlockLookup', featuresInBlocks, block, blockId, features);
    return features;
  },
  /** If block is a reference block, lookup features of the axis.
   * The results of sequence-search : blast-results are currently
   * added to selected.features (i.e. clickedFeatures) and
   * selected.labelledFeatures and their block is not viewed, so
   * associate them with the reference block / axis.
   * @return undefined if transientFeatures.length is 0,
   * so the caller can do :
   *  if (transientFeatures) {
   *      features = features.concat(transientFeatures);
   *  }
   */
  transientFeaturesLookup(block, listName) {
    const fnName = 'transientFeaturesLookup';
    let transientFeatures;
    /** not yet clear whether blast-results transient blocks should be
     * viewed - that would introduce complications requiring API
     * requests to be blocked when .datasetId.hasTag('transient')
     * For the MVP, return the features of un-viewed blocks, when block is reference.
     */
    if (! block.get('isData')) {
      let featuresByAxis = this.get('selected.' + listName + 'ByAxis'),
          axisFeatures = featuresByAxis && featuresByAxis.get(block);
      /** If block is not a key of featuresByAxis, find a key block
       * which matches by scope and dataset.  This may be required if
       * parent / reference block .name and .scope are different. It
       * can also handle transient results being loaded in the default
       * store, although this commit changes to load them in the same
       * store as the searched parent.
       */
      if (featuresByAxis && ! axisFeatures?.length) {
        const
        resultBlock = Array.from(featuresByAxis.keys()).find(
          b => ((b.scope || b.name) === block.scope) &&
            (b.get('datasetId.parent.id') === block.get('datasetId.id')));
        axisFeatures = featuresByAxis.get(resultBlock);
        if (! axisFeatures?.length) {
          const keys = Array.from(featuresByAxis.keys()).map(b => ([
            (b.scope || b.name), block.scope,
            b.get('datasetId.parent.id'), block.get('datasetId.id')]));
          dLog(fnName, keys, featuresByAxis);
        }
      }
      transientFeatures = axisFeatures && axisFeatures
        .filter(featureIsTransient);
      if (transientFeatures && ! transientFeatures.length) {
        transientFeatures = undefined;
      }
    }
    return transientFeatures;
  },

  /** Lookup selected.labelledFeatures for the given block.
   * @param listName name of set / selection / group of features :
   *   'clickedFeatures', 'labelledFeatures', or 'shiftClickedFeatures'
   * @param block Ember object
   */
  selectedFeaturesOfBlockLookup(listName, block) {
    let
    map = this.get('selected.' + listName + 'ByBlock'),
    features = map && map.get(block);
    let transientFeatures = this.transientFeaturesLookup(block, listName);
    features = arraysConcat(features, transientFeatures);

    if (trace)
      dLog('selectedFeaturesOfBlockLookup', listName, this.featuresInBlocks, block, block.id, features);
    return features;
  },

  /**
   * @param event d3 event,
   * @param feature
   * @param this component:draw/axis-ticks-selected
   */
  clickTriangle(event, feature) {
    //  feature === event.target.__data__
    dLog('clickTriangle', feature, this);
    if (this.controls.noGuiModeFilter()) {
    let features, listName;
    if (! event.shiftKey) {
      this.selected.clickLabel(feature);
      features = this.selected.labelledFeatures;
      listName = 'labelled';
    } else {
      this.selected.shiftClickFeature(feature);
      features = this.selected.shiftClickedFeatures;
      listName = 'shiftClicked';
      document.getSelection().removeAllRanges();
    }
    dLog(listName, features.mapBy('blockId.mapName'), features && features.map((f) => [f.name, f.value]));
    }
  },

  addRemoveKeyEventListener(listen) {
    const register = listen ? window.addEventListener : window.removeEventListener;
    ["keydown", "keypress", "keyup"].forEach(
      (eventName) => register(eventName, this.ctrlHandler, false));
  },
  listenCtrl : on('init', function () {
    this.addRemoveKeyEventListener(true);
  }),
  unListenCtrl: on('willDestroyElement', function() {
    this.addRemoveKeyEventListener(false);
  }),
  /** listener function registered by listenCtrl() */
  ctrlHandler(event) {
    // as in : query-params.js : optionsToDom()
    d3.select('body')
      .classed("ctrl-modifier", event.ctrlKey);
  }


});

