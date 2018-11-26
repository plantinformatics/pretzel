import Ember from 'ember';

/* global d3 */

const className = "feature-list";

export default Ember.Component.extend({

  classNames : [className],

  activeInput : Ember.computed(function () {
    let 
      /** can alternately get class .active from  "ul.nav.nav-tabs > li"
       */
      activeInputElt = Ember.$('.' + className + ' div#tab-features'),
    activeInput = activeInputElt.hasClass('active');
    console.log('activeInput', activeInputElt, activeInputElt.attr('class'), activeInput);
    return activeInput;
  }).volatile(),
  
  /** Once the user has selected which tab to provide the feature list,
   * changes to that value should update activeFeatureNameList and hence
   * goto-feature-list : getBlocksOfFeatures().
   *
   * We could also update activeFeatureNameList when user switches tabs, but
   * having the user click '->Blocks' seems the right flow; can add that after
   * trialling.
   */
  activeFeatureList  : Ember.computed('activeInput', 'featureNameList', 'selectedFeatures', function (newValue) {
    let
      activeInput = this.get('activeInput'),
    featureList = {};
    if (activeInput) {
      let fl = this.get('featureNameList').split(/[ \n\t]+/);
      // If string has leading or following white-space, then result of split will have leading / trailing ""
      if (fl.length && (fl[0] === ""))
        fl.shift();
      if (fl.length && (fl[fl.length-1] === ""))
        fl.pop();
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
    console.log('activeFeatureList', featureList);
    return featureList;
  })


  /*----------------------------------------------------------------------------*/

});
