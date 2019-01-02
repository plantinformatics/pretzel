import Ember from 'ember';

/* global d3 */

const className = "feature-list";

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

export default Ember.Component.extend({

  classNames : [className],
  classNameBindings: ['activeInput'],

  actions : {
    paste: function(event) {
      console.log('paste', event);
      let me = this;
      /** this function is called before jQuery val() is updated. */
      Ember.run.later(function () {
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
  featureNameList  : Ember.computed('featureNameListEnter', function () {
    let
      featureList = {};
    let text$ = this.$('textarea'),
      /** before textarea is created, .val() will be undefined. */
      fl = text$.val();
      if (fl)
      {
        fl = fl
        .split(/[ \n\t]+/);
      // If string has leading or following white-space, then result of split will have leading / trailing ""
      if (fl.length && (fl[0] === ""))
        fl.shift();
      if (fl.length && (fl[fl.length-1] === ""))
        fl.pop();
      }
    else  // e.g. if fl===""
      fl = [];

      text$.val(fl && fl.join('\n'));
      featureList.featureNameList = fl;
      featureList.empty = ! fl || (fl.length === 0);
      return featureList;
    }),
  selectedFeatureNames  : Ember.computed('selectedFeatures', function () {
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
  activeFeatureListBase  : Ember.computed('activeInput', 'featureNameList', 'selectedFeatureNames', function () {
    let featureList,
      activeInput = this.get('activeInput');
    if (activeInput)
      featureList = this.get('featureNameList');
    else
      featureList = this.get('selectedFeatureNames');
    console.log('activeFeatureList', activeInput, featureList);
    return featureList;
  }),
  /** When user clicks the '-> Blocks' button :
   *   if activeInput : read any text entered since the last newline / paste / etc.
   *   if ! activeInput, copy selectedFeatureNames to the input textarea
   */
  activeFeatureList  : Ember.computed('activeFeatureListBase', function () {
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
      text$ = this.$('textarea');
      text$.val(fl && fl.join('\n'));
    }
    return featureList;
  }).volatile(),

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
    this.incrementProperty('featureNameListEnter');
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
    if (this.get('activeInput'))
      this.set('activeInput', false);
    let text$ = this.$('textarea'),
    selectedFeatures = this.get('selectedFeatures'),
    selectedFeaturesNames = selectedFeatures.map(function (sf) {
      return sf.Feature;
    });
    console.log('selectedFeatures', selectedFeatures, selectedFeaturesNames);
    text$.val(selectedFeaturesNames.join('\n'));
  }


  /*----------------------------------------------------------------------------*/

});
