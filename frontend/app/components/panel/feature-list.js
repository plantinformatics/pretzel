import Ember from 'ember';

/* global d3 */

const className = "feature-list";

export default Ember.Component.extend({

  classNames : [className],
  classNameBindings: ['activeInput'],

  actions : {
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
  activeFeatureList  : Ember.computed('activeInput', 'featureNameList', 'featureNameListEnter', 'selectedFeatures', function (newValue) {
    let
      activeInput = this.get('activeInput'),
    featureList = {};
    if (activeInput) {
      let fl = this.get('featureNameList');
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
      this.set('featureNameList', fl && fl.join('\n'));
      featureList.featureNameList = fl;
      featureList.empty = ! fl || (fl.length === 0);
    }
    else {
      let selectedFeatures = featureList.selectedFeatures = this.get('selectedFeatures'), f;
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
    }
    console.log('activeFeatureList', activeInput, featureList);
    return featureList;
  }),

  /*----------------------------------------------------------------------------*/

  featureNameListInput() {
    console.log('featureNameListInput');
    this.incrementProperty('featureNameListEnter');
  },
  toSelectedFeatures() {
    console.log('toSelectedFeatures');
    this.set('activeInput', true);
  },
  fromSelectedFeatures() {
    console.log('fromSelectedFeatures');
    this.set('activeInput', false);
  }


  /*----------------------------------------------------------------------------*/

});
