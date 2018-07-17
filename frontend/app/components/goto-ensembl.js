import Ember from 'ember';

import { breakPoint } from '../utils/breakPoint';

/*----------------------------------------------------------------------------*/

export default Ember.Component.extend({

  website: 'GrainGenes',
  websites: Ember.String.w('GrainGenes Ensembl'),
  actions: {
    selectWebsite(website) {
      this.set('website', website);
    }
  },

  urlFunctions : {
    'GrainGenes' : 'urlGrainGenes',
    'Ensembl' : 'urlEnsembl'
  },
  /** Select function to calculate URL of featureName based on website.
   * @param this ember component
   */
  urlOf : function(website, featureName) {
    let
    urlFunctionName = this.get('urlFunctions')[website],
    urlFunction = urlFunctionName && this.get(urlFunctionName),
    url = featureName && urlFunction(featureName);
    console.log('urlOf', this.element, this.parentView.element, website, featureName, url);
    return url;
  },
  /** for now just show the first of selectedFeatures.
   * @return  feature name of the first element of selectedFeatures.
   */
  selectedFeatures0Name : Ember.computed('website', 'selectedFeatures.[]', function (newValue) {
    let
    selectedFeatures = this.get('selectedFeatures'),
    /**   form is e.g. : {Chromosome: "myMap:1A.1", Feature: "myMarkerA", Position: "0"} */
    selectedFeatures0 = selectedFeatures.length ? selectedFeatures[0] : undefined,
    featureName = selectedFeatures0 && selectedFeatures0.Feature;
    console.log('selectedFeatures0', selectedFeatures0, featureName);
    return featureName;
  }),
  urlSelected : Ember.computed('website', 'selectedFeatures0Name', function (newValue) {
    let website = this.get('website'),
    featureName = this.get('selectedFeatures0Name'),
    url = featureName && this.get('urlOf').apply(this, [website, featureName]);
    console.log('urlSelected', featureName, url);
    return url;
  }),
  url : Ember.computed('website', 'featureName', function (newValue) {
    let
      website = this.get('website'),
    featureName = this.get('featureName'),
    url = this.get('urlOf').apply(this, [website, featureName]);
    return url;
  }),

  urlGrainGenes : function(featureName) {
    /** e.g. Xgwm382, Xgwm382.1-2A, Xgwm382-2A.1 */
    let
    /** trim off leading X/x and trailing punctuation e.g. gwm382 */
    featureNameCore = featureName.replace(/^X/i, "").replace(/[-\.].*/, ""),
    protocol = "http://",
    domain = "wheat.pw.usda.gov",
    port = "",
    path = "/cgi-bin/GG3/report.cgi?",
    args1="class=marker;",
    query="query=*" + featureNameCore + "*;",
    args2="name=" + featureName,
    options2=";show=possibleorthologs",
    url = protocol + domain + port + path + args1 + query + args2 + options2;
    console.log("urlEnsembl", featureName);

    return url;
  },

  urlEnsembl : function(featureName) {
    let
    protocol = "http://",
    domain = "plants.ensembl.org",
    port = "",
    path = "/Triticum_aestivum/Search/Results?",
    args1="species=Triticum%20aestivum;idx=;",
    query="q=" + featureName + ";", // TRIAE_CS42_3DL_TGACv1_249024_AA0834820;
    args2="site=ensemblthis",
    url = protocol + domain + port + path + args1 + query + args2;
    console.log("urlEnsembl", featureName);

    return url;
  }

  /*----------------------------------------------------------------------------*/

});
