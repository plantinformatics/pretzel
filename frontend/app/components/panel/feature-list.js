import { computed } from '@ember/object';
import { later } from '@ember/runloop';
import Component from '@ember/component';
import { on } from '@ember/object/evented';
import { inject as service } from '@ember/service';

import $ from 'jquery';

import { uniq, concat, difference } from 'lodash/array';


/* global d3 */
const dLog = console.debug;

const className = "feature-list";

function logArray(a) { return a.length > 4 ? a.length : a; }


/**  data/event flow :

selectedFeatures

activeInput is true if this textarea is the current data source,
false when selectedFeatures is the current data source.

{{textarea featureNameList }}
  . edit or Enter
    -> set activeInput=true
  . Enter
    -> (click) Blocks [not implemented yet]

Blocks (featureSearch)
  . click : use value from (activeInput ? featureNameList : selectedFeatures)

arrow (left) toSelectedFeatures	:
  . copy featureNameList -> selectedFeatures
  . (probably filter : check which features are loaded)
  . set activeInput=true

arrow (right) fromSelectedFeatures
  . copy selectedFeatures -> featureNameList
  . display in textarea
  . set activeInput=false

 */

export default Component.extend({
  selected : service('data/selected'),

  classNames : [className],
  classNameBindings: ['activeInput'],

  actions : {
    paste: function(event) {
      console.log('paste', event);
      let me = this;
      /** this function is called before jQuery val() is updated. */
      later(function () {
        // featureNameListInput() does inputIsActive();
        me.featureNameListInput();
        // trigger fold
        console.log(me.get('featureNameList'));
      }, 500);
    },
    inputIsActive() {
      this.inputIsActive();
    },
    featureNameListInput() {
      this.featureNameListInput();
    },
    toSelectedFeatures() {
      this.toSelectedFeatures();
    },
    fromSelectedFeatures() {
      this.fromSelectedFeatures();
    }
  },

  listen: on('init', function() {
    this.get('selected').on('toggleFeature', this, 'toggleFeature');
  }),
  /** remove the binding created in listen() above, upon component destruction */
  unListen: on('willDestroyElement', function() {
    this.get('selected').off('toggleFeature', this, 'toggleFeature');
  }),



  activeInput : true,
  featureNameListEnter : 0,
  
  /** Once the user has selected which tab to provide the feature list,
   * changes to that value should update activeFeatureNameList and hence
   * goto-feature-list : getBlocksOfFeatures().
   *
   * We could also update activeFeatureNameList when user switches tabs, but
   * having the user click '->Blocks' seems the right flow; can add that after
   * trialling.
   */
  featureNameList : computed('featureNameListEnter', function () {
    return this.featureNameListGet();
  }),
  get featureNameListCurrent() {
    return this.featureNameListGet();
  },
  /** Read text from textarea, format into 1 feature name per line.
   * @return array of feature names, after formatting
   */
  featureNameListGet() {
    let
      featureList = {};
    /** jQuery handle of this textarea */
    let text$ = $('textarea', this.element),
      /** before textarea is created, .val() will be undefined. */
      fl = text$.val();
      if (fl)
      {
        fl = fl
        .split(/[ \n\t]+/);
      // If string has leading or following white-space, then result of split will have leading / trailing ""
      if (fl.length && (fl[0] === ""))
        fl.shift();
      }
    else  // e.g. if fl===""
      fl = [];

      text$.val(fl && fl.join('\n'));
      /** If the user has appended a \n, it is not removed from the textarea,
       * allowing them to type text on a new line;  instead the "" at the end
       * of fl[] is popped. */
      if (fl.length && (fl[fl.length-1] === ""))
        fl.pop();
      featureList.featureNameList = fl;
      featureList.empty = ! fl || (fl.length === 0);
      return featureList;
    },
  selectedFeatureNames  : computed('selectedFeatures', function () {
    let
    featureList = {};

      let selectedFeatures = this.get('selectedFeatures'), f;
      /* the empty value of selectedFeatures is [{}],
       * or [{Chromosome: null, Feature: null, Position: null}] after a selection
       * is cleared (by clicking on the axis outside the brush).
       * That seems worth investigating ..., but for this commit just recognise it.
       */
      featureList.empty =
        ! selectedFeatures
        || (selectedFeatures.length === 0)
        || ((selectedFeatures.length === 1)
            && ((d3.keys(f = selectedFeatures[0]).length === 0)
                || (f.Chromosome === null && f.Feature === null && f.Position === null)
               )
           );
    featureList.selectedFeatures = 
      selectedFeatures && selectedFeatures.mapBy('Feature');

    return featureList;
  }),
  activeFeatureListBase  : computed('activeInput', 'featureNameList', 'selectedFeatureNames', function () {
    let featureList,
      activeInput = this.get('activeInput');
    if (activeInput)
      featureList = this.get('featureNameListCurrent');
    else
      featureList = this.get('selectedFeatureNames');
    console.log('activeFeatureList', activeInput, featureList);
    return featureList;
  }),
  /** When user clicks the '-> Blocks' button :
   *   if activeInput : read any text entered since the last newline / paste / etc.
   *   if ! activeInput, copy selectedFeatureNames to the input textarea
   */
  get activeFeatureList () {
    /** This function could be : computed('activeFeatureListBase', function ... )
     * but would have to set up an event listener for input.
     * activeFeatureList() is called from toSelectedFeatures(), and
     * goto-feature-list : getBlocksOfFeatures() and lookupFeatureList(); those
     * don't currently require a CP.
     */
    let activeInput = this.get('activeInput');
    if (activeInput)
    {
      /* read any text entered since the last newline / paste / etc.  */
      this.featureNameListInput();
    }
    let featureList = this.get('activeFeatureListBase');
    if (! activeInput)
    {
      let fl = featureList.selectedFeatures,
      text$ = $('textarea', this.element);
      text$.val(fl && fl.join('\n'));
    }
    return featureList;
  },

  /*----------------------------------------------------------------------------*/

  /** The user has edited the featureNameList textarea, so note this input as active.
   */
  inputIsActive() {
    // console.log('inputIsActive');
    if (! this.get('activeInput'))
      this.set('activeInput', true);
  },
  /** Called when : enter, insert-newline, escape-press, paste.
   *
   * It would be possible, and somewhat simpler, to update featureNameList after
   * every key press, but that could trigger downstream recalculations and
   * produce a noisy display.  Instead it is updated only for these major
   * events, and the value of the textarea is read when the downstream component
   * requires it.
   */
  featureNameListInput() {
    console.log('featureNameListInput');
    this.inputIsActive();
    later(() => ! this.isDestroying && this.incrementProperty('featureNameListEnter'));
  },
  toSelectedFeatures() {
    console.log('toSelectedFeatures');
    if (! this.get('activeInput'))
      this.set('activeInput', true);
    else
      // if activeInput is not changed, then trigger a re-evaluation of activeFeatureList()
      this.featureNameListInput();
    let featureList = this.get('activeFeatureList'),
    selection = featureList.featureNameList
      .map(function (featureName) {
        let chrName = "", // e.g. "myMap:1A.1",
        position = "", // e.g. "12.3",
        result =
          {Chromosome: chrName, Feature: featureName, Position: position};
        return result;
      });
      this.set('selectedFeatures', selection);
  },
  fromSelectedFeatures() {
    console.log('fromSelectedFeatures');

    /** Append to selectedFeatures to text$, therefore set activeInput true.
     * (originally : replace instead of append, so activeInput was set false) */
    this.set('activeInput', true);

    let text$ = $('textarea', this.element),
    selectedFeatures = this.get('selectedFeatures');
    let selectedFeaturesEmpty = ! selectedFeatures.length ||
        ((selectedFeatures.length === 1) && (selectedFeatures[0].Feature === undefined));
    if (! selectedFeaturesEmpty) {
      let
      selectedFeaturesNames = selectedFeatures.map(function (sf) {
        return sf.Feature;
      });
      dLog('fromSelectedFeatures', logArray(selectedFeatures));
      this.appendSelectedFeatures(selectedFeaturesNames);
    }
  },
  /** Append the given selectedFeaturesNames to textarea, or filter them out if
   * remove is true.
   */
  appendSelectedFeatures(selectedFeaturesNames, remove) {
    dLog('appendSelectedFeatures', selectedFeaturesNames, remove);
    /** Append to selectedFeatures to text$, therefore set activeInput true.
     * (originally : replace instead of append, so activeInput was set false) */
    this.set('activeInput', true);

      let
      current = this.currentInputFeatures(),
      combined = current.length ? 
        (remove ? this.subtract : this.combine)(current, selectedFeaturesNames) :
        (remove ? [] : selectedFeaturesNames),
      newValue = combined.join('\n');
      console.log(logArray(current), 'selectedFeaturesNames', logArray(selectedFeaturesNames), logArray(combined));
      let text$ = $('textarea', this.element);
      text$.val(newValue);
  },
  toggleFeature(feature, added, listName) {
    // not interested in listName === 'labelledFeatures'.
    if (listName === 'features') {
      dLog('toggleFeature', feature, added);
      this.appendSelectedFeatures([feature.name], !added);
    }
  },
  currentInputFeatures () {
    let
    text$ = $('textarea', this.element),
    currentVal = text$.val(),
    array = ! currentVal ? [] : currentVal.split('\n');
    return array;
  },
  /** Combine the current input feature names and the brushed
   * selectedFeaturesNames to be appended.
   */
  combine(a, b) {
    let c = concat(a, b)
      .uniq();
    return c;
  },
  /** remove b from a
  */
  subtract(a, b) {
    let c = difference(a, b)
      .uniq();
    return c;
  },

  //----------------------------------------------------------------------------

  /** Respond to change of queryParamsState.searchFeatureNames by
   * copying it into input textarea featureNameListInput
   */
  searchFeatureNamesEffect: computed('queryParamsState.searchFeatureNames', function () {
    const
    fnName = 'searchFeatureNamesEffect',
    featureNames = this.queryParamsState.searchFeatureNames,
    value = featureNames.value;
    if (featureNames.changed && value) {
      /** if value is from URL, it may be comma-separated string instead of an array. */
      if (typeof value === 'string') {
        dLog(fnName, value);
      }
      const
      featureNamesArray =
        Array.isArray(value) ? value :
        (typeof value === 'string') ? value.split(',') : [value];
      this.appendSelectedFeatures(featureNamesArray, false);
      if (this.queryParamsState.naturalAuto.value) {
        dLog(fnName, value);
        this.getBlocksOfFeatures();
      }
    }
  }),

  //----------------------------------------------------------------------------


  /*----------------------------------------------------------------------------*/

});
