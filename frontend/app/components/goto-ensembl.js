import Ember from 'ember';
const { inject: { service } } = Ember;

import { breakPoint } from '../utils/breakPoint';

/*----------------------------------------------------------------------------*/

const trace_url = 0;
const dLog = console.debug;
dLog('goto-ensemble');

/*----------------------------------------------------------------------------*/

export default Ember.Component.extend({
  axisBrush: service('data/axis-brush'),

  classNames : [ 'goto-ensemble'],

  website: 'GrainGenes',
  websites: Ember.String.w('GrainGenes Ensembl Dawn'),
  /** user may provide a configuration URL for each website,
   * input via baseUrl. */
  baseUrls : {},

  actions: {
    selectWebsite(website) {
      this.set('website', website);
    }
  },

  /*--------------------------------------------------------------------------*/

  baseUrl : Ember.computed('website', 'baseUrls.@each', {
    get () {
      return this.get('baseUrls')[this.get('website')];
    },
    set(key, value) {
      let baseUrls = this.get('baseUrls');
      dLog('baseUrl', key, value);
      /** determine website from domain + path in url */
      let
      match = value.match(/([^?]+)/),
      path = match && match[1],
      /** using endsWith() ignores the protocol + port, which is e.g. http://  */
      website = path && (
        path.endsWith('crobiad.agwine.adelaide.edu.au/dawn/jbrowse/') ? 'Dawn' :
        path.endsWith('wheat.pw.usda.gov/cgi-bin/GG3/report.cgi') ? 'GrainGenes' :
        path.endsWith('plants.ensembl.org/Triticum_aestivum/Search/Results') ? 'Ensembl' : undefined
      );

      if (website === 'Dawn') {
        /**  extract &loc=...&,  */
        let
          match = value.match(/(.*)\&loc=([^&]*)(.*)/),
        /** e.g. "chr1B%3A321117692..321119204" */
        loc = match && match[2];
        /** - set axis y scale domain from loc (or set brush selection).  */
        /** record the url without the &loc= parameter */
        value = match && (match[1] + match[3]);
      }
      if (website) {
        baseUrls[website] = value;
        this.set('website', website);
      }

      return value;
    }
  }),

  /*--------------------------------------------------------------------------*/


  /** For each website, a function is defined which maps a featureName to a URL.
   * Now will probably add functions to map location (brushedDomain) to a URL,
   * so may factor the urlGrainGenes, urlEnsembl, urlDawn as classes with
   * .urlForLocation and .urlForFeatureName.
   */
  urlFunctions : {
    'GrainGenes' : 'urlGrainGenes',
    'Ensembl' : 'urlEnsembl',
    'Dawn' : 'urlDawn'
  },
  /** Select function to calculate URL of featureName based on website.
   * @param this ember component
   */
  urlOf : function(website, featureName) {
    let
    urlFunctionName = this.get('urlFunctions')[website],
    urlFunction = urlFunctionName && this.get(urlFunctionName),
    url = featureName && urlFunction.apply(this, [featureName]);
    if (trace_url)
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
    selectedFeatures0 = selectedFeatures && selectedFeatures.length ? selectedFeatures[0] : undefined,
    featureName = selectedFeatures0 && selectedFeatures0.Feature;
    if (trace_url)
      console.log('selectedFeatures0', selectedFeatures0, featureName);
    return featureName;
  }),
  urlSelected : Ember.computed('website', 'selectedFeatures0Name', function (newValue) {
    let website = this.get('website'),
    featureName = this.get('selectedFeatures0Name'),
    url = featureName && this.get('urlOf').apply(this, [website, featureName]);
    if (trace_url)
      console.log('urlSelected', featureName, url);
    return url;
  }),
  urlLocation : Ember.computed('website', 'selectedBlock', 'brushedDomain', function (newValue) {
    let url,
    website = this.get('website'),
    selectedBlock = this.get('selectedBlock');
    dLog('urlLocation', selectedBlock);
    if (selectedBlock) {
      let
        brushedDomain = this.get('brushedDomain'),
      featureName = this.get('selectedFeatures0Name');
       {
         /* signature of urlOf function is different for urlLocation(). */
         url = featureName && (website === 'Dawn') ?
           this.urlDawn(featureName, selectedBlock, brushedDomain) : 
           this.get('urlOf').apply(this, [website, featureName]);
      }
      if (trace_url)
        console.log('urlLocation', featureName, url);
    }
    return url;
  }),
  url : Ember.computed('website', 'featureName', 'baseUrl', function (newValue) {
    let
      website = this.get('website'),
    featureName = this.get('featureName'),
    url = this.get('urlOf').apply(this, [website, featureName]);
    return url;
  }),
  brush : Ember.computed('selectedBlock', function () {
    let brush,
    selectedBlock = this.get('selectedBlock');
    dLog('selectedBlock', selectedBlock);
    if (selectedBlock) {
      brush = this.get('axisBrush').brushOfBlock(selectedBlock);
    }
    return brush;
  }),
  /**
   * @return undefined if there is no brushed domain
   */
  brushedDomain : Ember.computed(
    // selectedBlock will change when a new brush is started
    'selectedBlock',
    'brush.brushedDomain.0', 'brush.brushedDomain.1', 'brush.zoomCounter',
    function () {
      let brushedDomain,
      brush = this.get('brush');
      if (brush) {
        brushedDomain = brush.get('brushedDomain');
        dLog(brush, 'brushedDomain', brushedDomain);
      }
      return brushedDomain;
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
    if (trace_url)
      console.log("urlGrainGenes", featureName);

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
    if (trace_url)
      console.log("urlEnsembl", featureName);

    return url;
  },

  urlDawn : function(featureName, selectedBlock, brushedDomain) {
    let
      baseUrl = this.get('baseUrl'),
    protocol = "http://",
    domain = "crobiad.agwine.adelaide.edu.au",
    port = "",
    path = "/dawn/jbrowse/?",
    args1='tracks=DNA%2CIWGSC_v1.0_HC_genes',
    locationQuery;
    dLog('urlDawn', selectedBlock);
    if (selectedBlock) {
      /** map to name used by Dawn, e.g. 'chr1A' */
      let chrName = 'chr' + selectedBlock.get('name');
      if (brushedDomain) {
        let 
          /** brush is Real, loc param is in base-pairs, so convert to Int. */
          domainBp = brushedDomain && brushedDomain.map((d) => d.toFixed()),
        locationText = domainBp[0] + '..' + domainBp[1];
        locationQuery = 'loc=' + chrName + '%3A' + locationText;
        this.set('anchorLocationText', locationText);
      }
    }
    let
    // query="q=" + featureName + ";",
    args2='highlight=',
    url = baseUrl || 
      (protocol + domain + port + path) + [args1, args2].join('&');
    url += '&' + locationQuery;
    if (trace_url)
      console.log("urlDawn", featureName);

    return url;
  }

  /*----------------------------------------------------------------------------*/

});
