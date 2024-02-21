import { later } from '@ember/runloop';
import { alias } from '@ember/object/computed';
import { computed } from '@ember/object';
import { w } from '@ember/string';
import Component from '@ember/component';
import { inject as service } from '@ember/service';

import { stacks, Stacked }  from '../utils/stacks';
import { breakPoint } from '../utils/breakPoint';

/*----------------------------------------------------------------------------*/

const trace_url = 0;
const dLog = console.debug;
dLog('goto-ensemble');

/*----------------------------------------------------------------------------*/

export default Component.extend({
  axisBrush: service('data/axis-brush'),

  classNames : [ 'goto-ensemble'],

  website: 'GrainGenes',
  websites: w('GrainGenes Ensembl Dawn Apollo'),
  /** user may provide a configuration URL for each website,
   * input via baseUrl. */
  baseUrls : {},

  actions: {
    selectWebsite(website) {
      this.set('website', website);
    }
  },

  /*--------------------------------------------------------------------------*/

  baseUrl : computed('website', 'baseUrls.@each', {
    get () {
      return this.get('baseUrls')[this.get('website')];
    },
    set(key, value) {
      /** {{ input }} calls set() with "" before the value which is pasted in, so ignore "". */
      if (value && (value !== "")) {
        let baseUrls = this.get('baseUrls');
        dLog('baseUrl', key, value);
        /** determine website from domain + path in url */
        let
          match = value.match(/([^?]+)/),
        path = match && match[1],
        /** using endsWith() ignores the protocol, which is typically http://, but may be https.
         * If the user has a self-hosted jbrowse etc then port may be non-empty, so it would be good to ignore that also.
         */
        website = path && (
          path.endsWith('crobiad.agwine.adelaide.edu.au/dawn/jbrowse/') ? 'Dawn' :
            path.endsWith('crobiad.agwine.adelaide.edu.au/dawn/jbrowse-prod/') ? 'Dawn' :
            path.endsWith('/jbrowse/') ? 'Apollo' :
            path.endsWith('jbrowse/index.html') ? 'Apollo' :
            path.endsWith('annotator/loadLink') ? 'Apollo' :
            path.endsWith('wheat.pw.usda.gov/cgi-bin/GG3/report.cgi') ? 'GrainGenes' :
            path.endsWith('plants.ensembl.org/Triticum_aestivum/Search/Results') ? 'Ensembl' : undefined
        );

        if ((website === 'Dawn') || (website === 'Apollo')) {
          /**  extract &loc=...&,  */
          let
            /** loc= may be preceded by ? or &; the ? should be included in value, but not the & */
            match = value.match(/(.*\??)&?loc=([^&]*)(.*)/),
          /** e.g. "chr1B%3A321117692..321119204" */
          loc = match && match[2];
          if (loc)
            /** set axis y scale domain from loc (or set brush selection).  */
            this.setDomainFromDawn(loc);
          /** record the url without the &loc= parameter */
          value = match && (match[1] + match[3]);
        }
        if (website) {
          baseUrls[website] = value;
          this.set('website', website);
        }
      }
      return value;
    }
  }),

  /*--------------------------------------------------------------------------*/

  /** these can be params to the component. */
  stacks,
  axes1d : alias('stacks.axes1d'),

  /** Search for axis which is showing selectedFeature.Chromosome.
   *
   * May later add a function to find corresponding block even if not viewed,
   * and show e.g. a green + for usr to view that block, or just display it.
   */
  axisOfSelectedFeature(selectedFeature) {
    let result, match;
    /** could use split, but this match will handle ':' in dataset name. */
    if ((match = selectedFeature.Chromosome.match(/(.+):(.+)/))) {
      let [all, datasetName, scope] = match;
      result = Stacked.axisOfDatasetAndScope(false, datasetName, scope);
    }
    return result;
  },
  /** convert the &loc= param from the Dawn URL to Pretzel blockId / axis / scope
   * This uses : dawnReferenceName = "Triticum_aestivum_IWGSC_RefSeq_v1.0",
   * which can be updated when Dawn switches to V2 RefSeq.
   */
  dawnLoc2Axis(loc) {
    let
      [all, scope, colon, loc0, loc1] = loc.match(/chr(..)(%3A|:)([0-9]+)..([0-9]+)/);

    let interval = (loc0 <= loc1) ? [loc0, loc1] : [loc0, loc1],
      dawnReferenceName = "Triticum_aestivum_IWGSC_RefSeq_v1.0",
    axis = 
      Stacked.axisOfDatasetAndScope(true, dawnReferenceName, scope),
    result = axis && {blockId: axis.axisName, axis, interval};
    // use .warn if a field in result is undefined.
    let log = (result && result.blockId && result.axis && loc0 && loc1) ? dLog : console.warn;
    log('dawnLoc2Axis', result, loc);
    return result;
  },
  /** Given the &loc= param from a Dawn URL pasted in, set the zoomedDomain of
   * the corresponding Pretzel axis to that interval.
   */
  setDomainFromDawn(loc) {
    let 
      a = this.dawnLoc2Axis(loc);
    // could use a.axis.axis1d
    if (a.blockId && a.interval.length && a.interval[0])
      this.setZoomedDomain(a.blockId, a.interval);
  },
  /** Zoom the nominated axis to the given domain.
   * @param axisId  blockId of primary block of axis (i.e. reference or GM).
   */
  setZoomedDomain(axisId, domain) {
    let
      axes1d = this.get('axes1d'),
    axis1d = axes1d[axisId];
    axis1d.setDomain(domain);
    axis1d.setZoomed(true);
    /* updateScaleDomain() occurs in response to dependency .domain, and
     * axisBrushShowSelection() uses y scale.
     */
    later(function () {
      stacks.oa.showResize(false, true); });
    /* showResize() or :
     // if brush is outside new domain
     removeBrushExtent(brushedAxisID);
     // else
     axisBrushShowSelection(p, gBrush);
     */
  },

  /*--------------------------------------------------------------------------*/


  /** For each website, a function is defined which maps a featureName to a URL.
   * Now will probably add functions to map location (brushedDomain) to a URL,
   * so may factor the urlGrainGenes, urlEnsembl, urlDawn as classes with
   * .urlForLocation and .urlForFeatureName.  partially done - @see ApolloJBrowse.urlLocation
   */
  urlFunctions : {
    'GrainGenes' : 'urlGrainGenes',
    'Ensembl' : 'urlEnsembl',
    // these sites may not have feature search
    // 'Dawn' :
    // 'Apollo' :
  },
  /** Select function to calculate URL of featureName based on website.
   * @param this ember component, which is applied to the urlFunction of the website.
   */
  urlOf : function(website, featureName) {
    let
    urlFunctionName = this.get('urlFunctions')[website],
    urlFunction = urlFunctionName && this.get(urlFunctionName),
    url = featureName && urlFunction && urlFunction.apply(this, [featureName]);
    if (trace_url)
      console.log('urlOf', this.element, this.parentView.element, website, featureName, url);
    return url;
  },
  /** for now just show the first of selectedFeatures.
   * @return  feature name of the first element of selectedFeatures.
   */
  selectedFeatures0Name : computed('website', 'selectedFeatures.[]', function (newValue) {
    let
    selectedFeatures = this.get('selectedFeatures'),
    /**   form is e.g. : {Chromosome: "myMap:1A.1", Feature: "myMarkerA", Position: "0"} */
    selectedFeatures0 = selectedFeatures && selectedFeatures.length ? selectedFeatures[0] : undefined,
    featureName = selectedFeatures0 && selectedFeatures0.Feature;
    if (trace_url)
      console.log('selectedFeatures0', selectedFeatures0, featureName);
    return featureName;
  }),
  /** construct the URL for .website and .selectedFeatures0Name
   */
  urlSelected : computed('website', 'selectedFeatures0Name', function (newValue) {
    let website = this.get('website'),
    featureName = this.get('selectedFeatures0Name'),
    url = featureName && this.get('urlOf').apply(this, [website, featureName]);
    if (trace_url)
      console.log('urlSelected', featureName, url);
    return url;
  }),
  /** construct the URL for .website and .brushedDomain
   */
  urlLocation : computed('website', 'selectedBlock', 'brushedDomain.{0,1}', function (newValue) {
    let url,
    website = this.get('website'),
    selectedBlock = this.get('selectedBlock');
    dLog('urlLocation', this.get('selectedBlock.id'));
    if (! selectedBlock) {
      let 
        /** overlap with selectedFeatures0Name() above. */
        selectedFeatures = this.get('selectedFeatures'),
      selectedFeatures0 = selectedFeatures && selectedFeatures.length ? selectedFeatures[0] : undefined,
      axis = selectedFeatures0 && this.axisOfSelectedFeature(selectedFeatures0);
      selectedBlock = axis && axis.referenceBlock;
    }
    if (selectedBlock) {
      let
        brushedDomain = this.get('brushedDomain'),
      featureName = this.get('selectedFeatures0Name');
       {
         /* signature of urlOf function is different for urlLocation(). */
         url = (website === 'Dawn') ? dawn.urlLocation(this, selectedBlock, brushedDomain) : 
           (website === 'Apollo') ? apollo.urlLocation(this, selectedBlock, brushedDomain) : 
           featureName && this.get('urlOf').apply(this, [website, featureName]);
      }
      if (trace_url)
        console.log('urlLocation', featureName, url);
    }
    return url;
  }),
  /** construct the URL for .website and the input .featureName
   */
  url : computed('website', 'featureName', 'baseUrl', function (newValue) {
    let
      website = this.get('website'),
    featureName = this.get('featureName'),
    url = this.get('urlOf').apply(this, [website, featureName]);
    return url;
  }),
  /** @return the handle of the axisBrush of .selectedBlock. */
  brush : computed('selectedBlock', function () {
    let brush,
    selectedBlock = this.get('selectedBlock');
    dLog('selectedBlock', selectedBlock);
    if (selectedBlock) {
      brush = this.get('axisBrush').brushOfBlock(selectedBlock);
    }
    return brush;
  }),
  /** Return the domain (selection) of .brush.
   * @return undefined if there is no brushed domain
   */
  brushedDomain : computed(
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
    /** GrainGenes appends .1, .2 etc to the gene name, so match with a trailing *.  */
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
    /** Ensembl now uses IWGSC_RefSeq_v2.0 names, so map the v1.0 names to 2.0 */
    featureName2 = featureName.replace(/(TraesCS..0)1/, '$12'),
    query="q=" + featureName2 + ";", // TRIAE_CS42_3DL_TGACv1_249024_AA0834820;
    args2="site=ensemblthis",
    url = protocol + domain + port + path + args1 + query + args2;
    if (trace_url)
      console.log("urlEnsembl", featureName);

    return url;
  },



  /*----------------------------------------------------------------------------*/

});

class ApolloJBrowse {
  constructor (additionalAttr) {
    this.port = '';

    if (additionalAttr)
      Object.assign(this, additionalAttr);
  };

}

/** Construct the Dawn URL for .selectedBlock and .brushedDomain
 * @param gotoUrl goto-ensembl component
 * @param selectedBlock and brushedDomain may be undefined, but the result is not very useful without them.
 */
ApolloJBrowse.prototype.urlLocation = function urlLocation (gotoUrl, selectedBlock, brushedDomain) {
    let
      baseUrl = gotoUrl.get('baseUrl'),
    domain = this.domain,
    port = this.port,
    path = this.path,
    args1 = this.args1,
    protocol = "http://",
    locationQuery;
    dLog('urlDawn', gotoUrl.get('selectedBlock.id'));
    if (selectedBlock) {
      /** map to name used by Dawn, e.g. 'chr1A' */
      let chrName = selectedBlock.get('name');
      if (chrName.startsWith('Chr')) {
	chrName.replace('Chr', 'chr');
      } else if (! chrName.startsWith('chr')) {
	chrName = 'chr' + chrName;
      } 
      if (brushedDomain) {
        let 
          /** brush is Real, loc param is in base-pairs, so convert to Int. */
          domainBp = brushedDomain && brushedDomain.map((d) => d.toFixed()),
        locationText = domainBp[0] + '..' + domainBp[1];
        locationQuery = 'loc=' + chrName + '%3A' + locationText;
        // also : probably clear anchorLocationText when ! brushedDomain or ! selectedBlock
        gotoUrl.set('anchorLocationText', locationText);
      }
    }
    let
    args2='highlight=',
    url = baseUrl || 
      (protocol + domain + port + path) + [args1, args2].join('&');
    if (locationQuery)
      url += '&' + locationQuery;
    if (trace_url)
      console.log("urlDawn", url);

    return url;
};

const dawn = new ApolloJBrowse({
  domain : "crobiad.agwine.adelaide.edu.au",

  path : "/dawn/jbrowse/?",
  /** the default tracks are the IWGSCv1 HC genes */
  args1 : 'tracks=DNA%2CIWGSC_v1.0_HC_genes'
});


const apollo = new ApolloJBrowse({
  domain : "apollo.tgac.ac.uk",
  path : "/Wheat_IWGSC_WGA_v1_0_browser/jbrowse/?",
  args1 : 'tracks=IWGSC_v1.1_genes'
});

