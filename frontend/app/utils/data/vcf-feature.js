import { get as Ember_get, set as Ember_set } from '@ember/object';
import { A as Ember_A } from '@ember/array';

import createIntervalTree from 'interval-tree-1d';

import { stringCountString, toTitleCase } from '../string';
import { stringGetFeature, stringSetSymbol, stringSetFeature } from '../panel/axis-table';
import { contentOf } from '../common/promises';
import { featuresIntervalsForTree } from './features';
import { intervalsIntersect } from '../interval-calcs';


/* global performance */

// -----------------------------------------------------------------------------

const dLog = console.debug;

const trace = 1;

const datasetSymbol = Symbol.for('dataset');
const featureSymbol = Symbol.for('feature');
const sampleMatchesSymbol = Symbol.for('sampleMatches');
const callRateSymbol = Symbol.for('callRate');

/** number of columns in the vcf output before the first sample column. */
const nColumnsBeforeSamples = 9;

const refAlt = ['ref', 'alt'];
const refAltHeadings = refAlt.map(toTitleCase);

/** map from vcf column name to Feature field name.
 */
const vcfColumn2Feature = {
  'CHROM' : 'blockId',
  'POS' : 'value',
  'ID' : '_name',
  'REF' : 'values.ref',
  'ALT' : 'values.alt',
};

const
columnOrder = [ 'MAF', 'LD Block', 'Ref', 'Alt' ],
columnOrderIndex = columnOrder.reduce(
  (result, name, index) => {
    result[name] = index;
    return result;
  },
  {});


/** for multiple features in a cell, i.e. merge rows - multiple features at a
 * position from different vcf datasets; could also merge columns (samples).  */
const cellMultiFeatures = false;

//------------------------------------------------------------------------------

/** Given a key within Feature.values, classify it as sample (genotype data) or other field.
 */
function valueNameIsNotSample(valueName) {
  return ['ref', 'alt', 'tSNP', 'MAF'].includes(valueName);
}

//------------------------------------------------------------------------------

/**
 * @return true if value is 0, 1, 2, or 0/0, 0/1, 1/0, 1/1,
 * @param value is defined, and is a string
 * It is assumed to be well-formed - only the first char is checked.
 */
function gtValueIsNumeric(value) {
  const char = value[0];
  return ['0', '1', '2'].includes(char);
}

//------------------------------------------------------------------------------

/** Convert punctuation in datasetId to underscore, to sanitize it and enable
 * use of the result as a CSS class name.
 *
 * Used in genotype table column headers for the dataset colour rectangle (border-left).
 * This is in support of selecting dataset colour using datasetId instead of
 * hard-wiring it onto every element; this will support future plans for user
 * editing of dataset colour.
 */
function datasetId2Class(datasetId) {
  const className = datasetId.replaceAll(/[ -,.-/:-?\[-^`{-~]/g, '_');
  return className;
}

// -----------------------------------------------------------------------------

/** If block is Germinate and block._meta.linkageGroupName is defined, insert
 * linkageGroupName into requestOptions, for use with URL path parameter /chromosome/
 * by utils/data/germinate.js : callsetsCalls(), via 
 * germinate-genotype.js :  germinateGenotypeLookup()
 */
function addGerminateOptions(requestOptions, block) {
  if (block?.hasTag('Germinate') && block._meta?.linkageGroupName) {
    requestOptions.linkageGroupName = block._meta.linkageGroupName;
  }
  return requestOptions;
}

//------------------------------------------------------------------------------

/** Lookup the genotype for the selected samples in the interval of the brushed block.
 * The server store to add the features to is derived from
 * vcfGenotypeLookupDataset() param blockV, from brushedOrViewedVCFBlocksVisible,
 * which matches vcfDatasetId : scope
 * @param auth  auth service for ajax
 * @param samples to request, may be undefined or []
 * Not used if requestSamplesAll
 * @param domainInteger  [start,end] of interval, where start and end are integer values
 * @param requestOptions :
 * {requestFormat, requestSamplesAll, headerOnly},
 * . requestFormat 'CATG' (%TGT) or 'Numerical' (%GT for 01)
 * . headerOnly true means -h (--header-only), otherwise -H (--no-header)
 * . linkageGroupName defined if isGerminate
 *
 * @param vcfDatasetId  id of VCF dataset to lookup
 * @param scope chromosome, e.g. 1A, or chr1A - match %CHROM chromosome in .vcf.gz file
 * @param rowLimit
 */
function vcfGenotypeLookup(auth, samples, domainInteger, requestOptions, vcfDatasetId, scope, rowLimit) {
  const
  fnName = 'vcfGenotypeLookup',

  region = scope + ':' + domainInteger.join('-'),
  requestFormat = requestOptions.requestFormat,
  /** this dataset has tSNP in INFO field */
  requestInfo = requestFormat && (vcfDatasetId === 'Triticum_aestivum_IWGSC_RefSeq_v1.0_vcf_data'),
  preArgs = Object.assign({
    region, samples, requestInfo
  }, requestOptions);
  // parent is .referenceDatasetName


  /* reply time is generally too quick to see the non-zero count, so to see the
   * count in operation use +2 here. */
  auth.apiStatsCount(fnName, +1);

  /** Currently passing datasetId as param 'parent', until requirements evolve.
   * The VCF dataset directories are just a single level in $vcfDir;
   * it may be desirable to interpose a parent level, e.g. 
   * vcf/
   *   Triticum_aestivum_IWGSC_RefSeq_v1.0/
   *     Triticum_aestivum_IWGSC_RefSeq_v1.0_vcf_data
   * It's not necessary because datasetId is unique.
   * (also the directory name could be e.g.  lookupDatasetId ._meta.vcfFilename instead of the default datasetId).
   */
  const
  textP = auth.vcfGenotypeLookup(vcfDatasetId, scope, preArgs, rowLimit, {} )
    .then(
      (textObj) => {
        /* Result from Pretzel API endpoint is vcfGenotypeLookup is {text};
         * result from Germinate is an array, recognised by vcf-feature.js : resultIsGerminate(). */
        const text = textObj.text || textObj;
        auth.apiStatsCount(fnName, -1);
        return text;
      });
  return textP;
}


//------------------------------------------------------------------------------


/* sample data :

 * -------------------------------------
 * default output format :

##fileformat=VCFv4.1
##FILTER=<ID=PASS,Description="All filters passed">
##phasing=none
##INFO=<ID=NS,Number=1,Type=Integer,Description="Number of Samples With Data">

##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype as 0/1">

#CHROM	POS	ID	REF	ALT	QUAL	FILTER	INFO	FORMAT	ExomeCapture-DAS5-003227	ExomeCapture-DAS5-002775	ExomeCapture-DAS5-002986
chr1A	327382120	scaffold22435_31704476	G	A	100	PASS	AC=3;AN=6;NS=616;MAF=0.418019;AC_Het=233;tSNP=.;pass=no;passRelaxed=no;selected=no	GT:GL:DP	1/0:-7.65918,-2.74391e-08,-7.48455:6	1/0:-5.41078,-0.00397816,-2.1981:3	1/0:-4.50477,-1.46346e-05,-10.5809:6

 * -------------------------------------
 * requestFormat === 'CATG' : formatArgs = '-H  -f "%ID\t%POS[\t%TGT]\n"' :

# [1]ID	[2]POS	[3]ExomeCapture-DAS5-002978:GT	[4]ExomeCapture-DAS5-003024:GT	[5]ExomeCapture-DAS5-003047:GT	[6]ExomeC
scaffold38755_709316	709316	C/C	C/T	C/C	C/C	C/C	./.	C/C	C/C	C/C	C/T	C/C	C/C	C/C	C/C	C/T	C/C	C/C	C/C	C/C	C/T	C/C	C/C	C

 * -------------------------------------
 * requestFormat === 'Numerical' : formatArgs = '-H  -f "%ID\t%POS[\t%GT]\n"' :

# [1]ID	[2]POS	[3]ExomeCapture-DAS5-002978:GT	[4]ExomeCapture-DAS5-003024:GT	[5]ExomeCapture-DAS5-003047:GT	[6]ExomeC
scaffold38755_709316	709316	0/0	0/1	0/0	0/0	0/0	./.	0/0	0/0	0/0	0/1	0/0	0/0	0/0	0/0	0/1	0/0	0/0	0/0	0/0	0/1	0/0	0/0	0


*/




/** Parse VCF output and add features to block.
 * @return
 *  { createdFeatures : array of created Features,
 *    sampleNames : array of sample names }
 *
 * @param block view dataset block for corresponding scope (chromosome)
 * @param requestFormat 'CATG', 'Numerical', ...
 * @param replaceResults  true means remove previous results for this block from block.features[] and selectedFeatures.
 * @param selectedFeatures  updated directly - can change to use updatedSelectedFeatures
 * @param text result from bcftools request
 */
function addFeaturesJson(block, requestFormat, replaceResults, selectedFeatures, text) {
  const fnName = 'addFeaturesJson';
  dLog(fnName, block.id, block.mapName, text.length);
  /** optional : add fileformat, FILTER, phasing, INFO, FORMAT to block meta
   * read #CHROM or '# [1]ID' column headers as feature field names
   * parse /^[^#]/ (chr) lines into features, add to block
   */
  let
  createdFeatures = [],
  /** The same features as createdFeatures[], in selectedFeatures format. */
  selectionFeatures = [],
  /** if the output is truncated by rowLimit aka nLines, the last line will not
   * have a trailing \n, and is discarded.  If incomplete lines were not
   * discarded, values.length may be < 4, and feature.value may be undefined.
   */
  lines = text.split('\n'),
  meta = {},
  /** true if column is genotype format value. */
  columnIsGT,
  columnNames,
  sampleNames,
  nFeatures = 0;
  dLog(fnName, lines.length);
  if (text && text.length && (text.charAt(text.length-1) !== '\n')) {
    dLog(fnName, 'discarding incomplete last line', lines[lines.length-1]);
    lines.splice(-1, 1);
  }

  if (replaceResults) {
    // let mapChrName = Ember_get(block, 'brushName');
    /* remove features of block from createdFeatures, i.e. matching Chromosome : mapChrName
     * If the user has renewed the axis brush, then selectedFeatures will not
     * contain any features from selectionFeature in previous result; in that
     * case this has no effect and none is required.
     * If the user send a new request with e.g. changed samples, then this would apply.
     */
    let blockSelectedFeatures = selectedFeatures.filter((f) => f.feature.get('blockId.id') === block.id);
    if (blockSelectedFeatures.length) {
      selectedFeatures.removeObjects(blockSelectedFeatures);
    }

    if (block.get('features.length')) {
      // alternative : block.set('features', Ember_A());
      block.features.removeAt(0, block.get('features.length'));
    }
  }

  lines.forEach((l, lineNum) => {
    if (l.startsWith('##')) {
      const nameVal = l.match(/^##([^=]+)=(.*)/);
      if (nameVal.length > 2) {
        /** ##INFO and ##FORMAT are duplicated : could .match(/.*ID=(.+),(.+)>/) and use ID to store [2] in meta.{INFO,FORMAT}.<ID>
         * ##bcftools_{viewVersion,viewCommand} are also duplicated, the last pair generated this output so it is of more interest.
         */
        meta[nameVal[1]] = nameVal[2];
      }
    } else if (l.startsWith('#CHROM')) {
      columnNames = l.slice(1).split('\t');
      sampleNames = columnNames.slice(nColumnsBeforeSamples);
    } else if (l.startsWith('# [1]ID')) {
      // # [1]ID	[2]POS	[3]ExomeCapture-DAS5-002978:GT	[4]ExomeCapture-DAS5-003024:GT	[5]ExomeCapture-DAS5-003047:GT	[6]ExomeC
      columnIsGT = l
        .split(/\t\[[0-9]+\]/)
        .map((name) => name.endsWith(':GT'));
      // trim off :GT, and split at 'tab[num]'
      columnNames = l
        .replaceAll(':GT', '')
        .split(/\t\[[0-9]+\]/);
      columnNames[0] = columnNames[0].replace(/^# \[1\]/, '');
      // nColumnsBeforeSamples is 2 in this case : skip ID, POS.
      sampleNames = columnNames.slice(2);
    } else if (columnNames && l.length) {
      const values = l.split('\t');

      let feature = values.reduce((f, value, i) => {
        const fieldName = columnNames[i];

        let fieldNameF;
        /* vcfColumn2Feature[] provides Feature field name corresponding to the
         * column name, for the common columns; for other cases this is
         * overridden in the switch default.
         */
        fieldNameF = vcfColumn2Feature[fieldName];
        /** maybe handle samples differently, e.g. Feature.values.samples: []
         * if (i > nColumnsBeforeSamples) { ... } else
         */
        switch (fieldName) {
        case 'CHROM' :
          let scope = value.replace(/^chr/, '');
          if (scope !== block.scope) {
            dLog(fnName, value, scope, block.scope, fieldName, i);
            value = null;
          } else {
            value = block;
          }
          break;

        case 'POS' :
          value = +value;
          f['value_0'] = value;
          value = [ value ];
          break;

        case 'ID' :
        case 'REF' :
        case 'ALT' :
          break;

        default :
          fieldNameF = 'values.' + fieldName;
        }
        if (! fieldNameF) {
          dLog(fnName, fieldName, value, i);
        } else {
          /** match values. and meta.  */
          let prefix = fieldNameF.match(/^([^.]+)\..*/);
          prefix = prefix && prefix[1];
          if (prefix) {
            /** replace A/A with A, 1/1 with 2 (i.e. x/y -> x+y). */
            if (columnIsGT[i]) {
              let match = value.match(/^(\w)[|/](\w)$/);
              if (! match) {
              } else if (requestFormat === 'Numerical') {
                // +"0" + "0" is "00", so the + + is required.
                value = '' + (+match[1] + +match[2]);
              } else /* CATG */
              if (match[1] === match[2]) {
                value = match[1];
              }
            }
            if (! f[prefix]) {
              f[prefix] = {};
            }
            if (fieldName.match(/\./)) {
              // Ember_set() interprets dot in field name, so use [] =
              f[prefix][fieldName] = value;
            } else {
              /* could also use Ember_set() when ! prefix. */
              Ember_set(f, fieldNameF, value);
            }
          } else {
            f[fieldNameF] = value;
          }
        }
        return f;
      }, {});
      // or EmberObject.create({value : []});

      /* CHROM column is present in default format, and omitted when -f is used
       * i.e. 'CATG', 'Numerical', so in this case set .blockId here. */
      if (requestFormat) {
        feature.blockId = block;
      }

      /** based on similar : components/table-brushed.js : afterPaste()  */

      /** If it is required for vcfFeatures2MatrixView() to create displayData
       * without creating model:Feature in the Ember data store, the following
       * part can factor out as a separate function, returning an array of
       * native JS objects at this point, and passing those to the 2nd function
       * for creation of model:Feature
       */
      if (feature.blockId && feature.value?.length && feature._name) {
        // trace level is e.g. 0,1,2,3; the number of rows displayed will be e.g. 0,2,4,8.
        if (trace && (lineNum < (1 << trace))) {
          dLog(fnName, 'newFeature', feature);
        }

        // in this case feature.blockId is block
        let store = feature.blockId.get('store');

        /** name is used in CSS selector, e.g. in utils/draw/axis.js :
         * axisFeatureCircles_selectOne{,InAxis}(), and . and : are not valid
         * for that use. */
        const separator = '_';
        if (feature._name === '.') {
          // Use chr:position:ref:alt, with separator in place of ':'
          feature._name = block.name + separator + feature.value[0];
          ['ref', 'alt'].forEach(a => {
            const value = feature.values[a];
            if (value) {
              feature._name += separator + value;
            }
          });
        }
        if (feature._name) {
          feature._name = datasetId2Class(feature._name);
        }

        // .id is used by axisFeatureCircles_eltId().
        // ._name may be also added to other blocks.
        feature.id = block.id + '_' + feature._name;
        let existingFeature = store.peekRecord('Feature', feature.id);
        if (existingFeature) {
          mergeFeatureValues(existingFeature, feature);
          feature = existingFeature;
          // this is included in createdFeatures, since it is a result from the current request.
        } else {
          // Replace Ember.Object() with models/feature.
          feature = store.createRecord('Feature', feature);
          /** fb is a Proxy */
          let fb = feature.get('blockId');
          if (fb.then) {
            fb.then((b) => feature.set('blockId', b));
          }
        }
        nFeatures++;

        let mapChrName = Ember_get(feature, 'blockId.brushName');
        let selectionFeature = {Chromosome : mapChrName, Feature : feature.name, Position : feature.value[0], feature};

        /* vcfFeatures2MatrixView() uses createdFeatures to populate
         * displayData; it could be renamed to resultFeatures; the
         * feature is added to createdFeatures regardless of
         * existingFeature.
         */
        createdFeatures.push(feature);
        selectionFeatures.push(selectionFeature);
        // If existingFeature then addObject(feature) is a no-op.
        if (replaceResults || ! existingFeature) {
          block.features.addObject(feature);
        }
      }

    }
  });
  selectedFeatures.pushObjects(selectionFeatures);
  blockEnsureFeatureCount(block);
  block.addFeaturePositions(createdFeatures);


  if (! columnNames || ! sampleNames) {
    dLog(fnName, lines.length, text.length);
  }

  let result = {createdFeatures, sampleNames};
  return result;
}

//------------------------------------------------------------------------------

/** If block.featureCount is undefined, then it can be set from block.features.length.
 * This is used when features are added from genotype calls received from VCF or Germinate.
 * The features received are likely only a small part of the chromosome, so the
 * count is just a lower bound.  Also it is likely that block.featureCount will
 * be defined from received blockFeaturesCounts; this is just a fall-back.
 * (possibly the first vcf result may arrive before blockFeaturesCounts if
 * blocks are viewed from URL)
 */
function blockEnsureFeatureCount(block) {
  if (block.get('featureCount') === undefined) {
    block.set('featureCount', block.get('features.length'));
  }
}

// -----------------------------------------------------------------------------

/** Merge feature.values into existingFeature.values
 */
function mergeFeatureValues(existingFeature, feature) {
  Object.entries(feature.values).forEach((e) => {
    if (existingFeature.values[e[0]] !== e[1]) {
      if (trace > 2) {
        dLog(feature.id, existingFeature.values[e[0]] ? 'setting' : 'adding', e);
      }
      existingFeature.values[e[0]] = e[1];
    }
  });
}

//------------------------------------------------------------------------------

/** @return true if the genotypeLookup API result is from Germinate,
 * false if VCF, from bcftools
 */
function resultIsGerminate(data) {
  return Array.isArray(data);
}

/** Parse Germinate genotype calls result and add features to block.
 * @return
 *  { createdFeatures : array of created Features,
 *    sampleNames : array of sample names }
 *
 * @param block view dataset block for corresponding scope (chromosome)
 * @param requestFormat 'CATG', 'Numerical', ...
 * Unlike bcftools, Germinate probably sends results only in CATG (nucleotide)
 * format, which is the format it uses for upload and storage in HDF.
 * @param replaceResults  true means remove previous results for this block from block.features[] and selectedFeatures.
 * @param selectedFeatures  same comment as per addFeaturesJson().
 * @param data result from Germinate callsets/<datasetDbId>/calls request
 * @param options { nSamples }
 */
function addFeaturesGerminate(block, requestFormat, replaceResults, selectedFeatures, data, options) {
  const fnName = 'addFeaturesGerminate';
  dLog(fnName, block.id, block.mapName, data.length);

  if (replaceResults) {
    dLog(fnName, 'replaceResults not implemented');
  }
  if (false)
  if ((options.nSamples !== undefined) && (data.length > options.nSamples)) {
    dLog(fnName, 'truncate data', data.length, options.nSamples);
    data = data.slice(0, options.nSamples);
  }

  const
  store = block.get('store'),
  columnNames = data.mapBy('callSetName').uniq(),
  sampleNames = columnNames,
  selectionFeatures = [],
  createdFeatures = data.map((call, i) => {
    const f = {values : {}};
    /* Will lookup f.value in block.features interval tree,
     * and if found, merge with existing feature - factor out use of
     * mergeFeatureValues() in addFeaturesJson().
     * Using createdFeatures.push(feature) instead of =data.map()
     */
    // call.callSetDbId identifies sample name : callSetName
    // previously seeing in results : 'CnullT' - this is now fixed in java.
    const genotypeValue = call.genotypeValue;
    f.values[call.callSetName] = genotypeValue;
    /* "variantName": "m2-23.0" 
     * m2-23.0 => m2 is marker name and 23.0 is its position
     * Some of the marker names contain '-', e.g. 'scaffold77480-1_24233-24233.0'
     * so instead of split('-'), use .match(/(.+) ... ) which is greedy.
     */
    let
    [wholeString, markerName, positionText] = call.variantName.match(/(.+)-(.+)/),
    position = +positionText;
    if (isNaN(position)) {
      // handle Oct19 format :  dbid_mapid_ exome SNP name e.g. 6_20_6_scaffold77480, or?  scaffold72661_85293-85293.0
      markerName = positionText;
    } else {
      f.value_0 = position;
      f.value = [position];
    }

    let feature = f;
    /** sampleID corresponds to callSetName, so exclude it from the feature name/id */
    const [datasetID, sampleID] = call.callSetDbId.split('-');
    /* .id is unique per genotype table row;  for 1 feature per cell, append : + '_' + call.callSetName */
    feature._name = markerName;
    feature.id =
      block.id + '_' + datasetID + '_' + markerName;
    let existingFeature = store.peekRecord('Feature', feature.id);
    if (existingFeature) {
      mergeFeatureValues(existingFeature, feature);
      feature = existingFeature;
      // this is included in createdFeatures, since it is a result from the current request.
      // as noted in addFeaturesJson(), can rename to resultFeatures.
    } else {
      // addFeaturesJson() uses feature.blockId - not sure if that is applicable
      feature.blockId = block;
      // Replace Ember.Object() with models/feature.
      feature = store.createRecord('Feature', feature);
    }

    return feature;
  });

  dLog(fnName, data.length, columnNames.length);

  // copied from addFeaturesJson() - may be similar enough to factor.
  createdFeatures.forEach(feature => {
    let mapChrName = block.get('brushName');
    let selectionFeature = {Chromosome : mapChrName, Feature : feature.name, Position : feature.value[0], feature};

    selectionFeatures.push(selectionFeature);
    // block.features.addObject(feature);
  });

  selectedFeatures.pushObjects(selectionFeatures);
  blockEnsureFeatureCount(block);
  block.addFeaturePositions(createdFeatures);

  let result = {createdFeatures, sampleNames};
  return result;
}


// -----------------------------------------------------------------------------

/** if string.match(regexp), return match[valueIndex], otherwise undefined. 
 */
function matchExtract(string, regexp, valueIndex) {
  let match = string.match(regexp),
      value = match && match[valueIndex];
  return value;
}


/** Passed from featureForMatrixColumn() to featureName(), which is also used by
 * this whole suite of functions, so it will have to be passed through, maybe as
 * formatOptions.  Defer until the formatting is settled.
 *   featureNameValue(),
 *   featurePosition(),
 *   featureValues(),
 *   featureValuesRefAlt(),
 *   featureBlockColour(),
 */
let singleBlock;
/**
 * @param singleBlock
 * If only 1 block / dataset, then dataset name is not required in column
 * headings, and not required to disambiguate feature (row) names.
 * @param feature
 */
function featureName(/*singleBlock,*/ feature) {
  /** Use first 5 chars of datasetId; will remove this from left column,
   * but retain prefix for uniqueness until row merging is implemented.
   */
  let name = feature.name;
  if (! singleBlock) {
    name = feature.get('blockId.brushName').slice(0, 5) + ' ' + name;
  }
  return name;
}
function featureValue(f) {
  return f.value[0];
}
/** Extract a field from feature.values.
 * @param feature Ember data store Feature object
 * @param fieldName field within feature.values{} to access
 * @return undefined if feature.values does not have that field
 */
function featureValuesField(feature, fieldName) {
  return feature.values[fieldName];
}
/** Usage : featureArray.sort(featureSortComparator)
 */
function featureSortComparator(a,b) {
  const order = a.value[0] - b.value[0];
  return order;
}

/** Construct a feature in the form expected by matrix-view in columns[].features[]
 * Used as a base for featurePosition() and featureBlockColour().
 * @return {name, value} with Symbol('feature')
 * @param value to assign to result feature .value
 */
function featureNameValue(feature, value) {
  let
  name = featureName(feature),
  fx = {name, value};
  fx[featureSymbol] = feature;
  return fx;
}
/**
 * @param i select .value[] : 0 : start, 1 : end
 */
function featurePosition(feature, i) {
  // or featureValue()
  const value = feature.value[i || 0];
  return featureNameValue(feature, value);
}
/**
 * @param fieldName select .values[fieldName], e.g. 'ref', 'alt'
 */
function featureValues(feature, fieldName) {
  const value = featureValuesField(feature, fieldName);
  return featureNameValue(feature, value);
}
/** When in the 012 view, colour the ref/alt with the 2 colours used for the
 * rest of the genotypes.
 * Used when (requestFormat === 'Numerical').
 */
function refAltNumericalValue(fieldName) {
  /** technically alt value is 1 copy of alt, so 1 makes sense, but 2 will have consistent colour.  */
  return (fieldName === 'ref') ? '0' : '2';
}
/** As for featureValues(), but used for Ref & Alt values to show them according
 * to requestFormat.
 */
function featureValuesRefAlt(requestFormat, feature, fieldName) {
  let value;
  /** As noted above in refAltNumericalValue() : When in the 012 view, colour
   * the ref/alt with [012 colours]; in the first implementation the value was
   * also shown as '0' or '2', using refAltNumericalValue().  Now instead the
   * nucleotide value is shown, and only the colour is changed to 012; this is
   * done via refAltCopyColour() in matrix-view
   */
  const showRefAltAsNumerical = false;
  if (showRefAltAsNumerical && (requestFormat === 'Numerical')) {
    value = refAltNumericalValue(fieldName);
  } else {
    value = featureValuesField(feature, fieldName);
  }
  return featureNameValue(feature, value);
}

function featureBlockColour(feature, i) {
  /** preferably use : FeatureTicks:featureColour() (factor out of components/draw/axis-1d.js)  */
  const
  value = featureBlockColourValue(feature);
  return featureNameValue(feature, value);
}
function featureBlockColourValue(feature) {
  const
  axis1d = feature.get('blockId.axis1d'),
  blockColourValue = axis1d.blockColourValue(feature.get('blockId'));
  return blockColourValue;
}

function featureHaplotype(feature, i) {
  const
  value = featureHaplotypeValue(feature);
  return featureNameValue(feature, value);
}
function featureHaplotypeValue(feature) {
  /** a number, or ".", which means no value  */
  const haplotype = feature.get('values.tSNP');
  return haplotype;
}

function featureMaf(feature, i) {
  const
  value = featureMafValue(feature);
  return featureNameValue(feature, value);
}
function featureMafValue(feature) {
  /** a number, domain [0,1]  */
  const maf = feature.get('values.MAF');
  return maf;
}

//------------------------------------------------------------------------------

/** @return true if sampleName is filtered out by haplotypeFilters.
 * @param block which contains LD Block / tSNP / haplotype which is applying a filter to sampleName.
 * block is defined.
 * @param sampleName
 * @return true / false or undefined; if undefined then the sample is not
 * filtered out - there may be no filter on this block.
 */
function sampleIsFilteredOut(block, sampleName) {
  /* can return hide=undefined if ! block[haplotypeFiltersSymbol] - probably no faster. */
  const
  matches = block[sampleMatchesSymbol];
  let hide;
  // matches may be empty
  if (matches) {
    // counts is now distance, replacing {matches,mismatches}.
    /** matches may not contain all samples of block, because of samplesLimit. */
    const counts = matches[sampleName];
    /** also done in matrix-view.js : showHideSampleFn() */
    hide = counts;
  }
  return hide;
}
/** @see sampleIsFilteredOut()
 * @param blocks array of blocks which are displayed in the genotype table;
 * this derives from brushedVCFBlocks.
 * @param sampleName
 * sampleName may be present in multiple blocks, but in practice the name prefix
 * will differ, and possibly also naming system.
 * @param sampleFilter undefined or optional additional filter (callRate filter)
 * @return true / false or undefined; if undefined then the sample is not
 * filtered out - there may be no filter on its block.
 */
function sampleIsFilteredOutBlocks(blocks, sampleName, sampleFilter) {
  const
  /** find if one of the blocks defines a show/hide status for sampleName.
   * block can be skipped if ! block[haplotypeFiltersSymbol]; probably similar execution time.
   * Can now use (added) sampleName2Block[sampleName] for block of sampleName.
   */
  block = blocks.find((block) => block[sampleMatchesSymbol]?.[sampleName]);
  let hide = block && sampleIsFilteredOut(block, sampleName);
  if (! hide) {
    const block = blocks.find((block) => block[callRateSymbol]?.[sampleName]);
    hide = block && sampleFilter && ! sampleFilter(block, sampleName);
  }
  return hide;
}

//------------------------------------------------------------------------------

/** Map sampleName 'tSNP' -> 'LD Block'
 * Related : caseRefAlt() : refAlt.includes(), toTitleCase()
 */
function sampleName2ColumnName(sampleName) {
  if (sampleName === 'tSNP') {
    sampleName = 'LD Block';
  }
  return sampleName;
}

function columnNameAppendDatasetId(columnName, datasetId) {
  /** Assume the SNPs are bi-allelic, so only display 1 Ref/Alt
   * regardless of multiple datasets. */
  if (! refAltHeadings.includes(columnName)) {
    columnName = columnName + '\t' + datasetId;
  }
  return columnName;
}
function columnName2SampleName(columnName) {
  const sampleName = columnName.split('\t')[0];
  return sampleName;
}

//------------------------------------------------------------------------------



/** Map the result of vcfGenotypeLookup() to the format expected by component:matrix-view param displayData
 *  columns [] -> {features -> [{name, value}...],  datasetId.id, name }
 *
 * Originally block was a param, but now it is derived from features, because
 * there may be features of multiple blocks.
 *
 * @param requestFormat 'CATG', 'Numerical', ...
 * @param added
 *  { createdFeatures : array of created Features,
 *    sampleNames : array of sample names }
 * @param featureFilter filter applied to add.createdFeatures
 * @param sampleFilter undefined or optional additional filter (callRate filter)
 * @param sampleNamesCmp undefined, or a comparator function to sort sample columns
 * @param options { userSettings }
 *
 * @return displayData
 */
function vcfFeatures2MatrixView(requestFormat, added, featureFilter, sampleFilter, sampleNamesCmp, options) {
  const fnName = 'vcfFeatures2MatrixView';
  /** createdFeatures : array of model:Feature (could be native JS objects - see
   * comment in addFeaturesJson() */
  let {createdFeatures, sampleNames} = added;
  const showHaplotypeColumn = createdFeatures.length && createdFeatures[0].values.tSNP;
  /** The param added.createdFeatures could be grouped by block.
   * Ordering by sampleName seems more useful, although not clear how often sampleName appears in 2 blocks.
   */
  const
  blocks = createdFeatures.reduce((result, feature) => {
    result.set(feature.get('blockId.content'), true);
    return result;
  }, new Map()),
  blocksArray = Array.from(blocks.keys()),
  gtDatasetIds = blocksArray.mapBy('datasetId.id');
  /** If only 1 block / dataset, then dataset name is not required in column
   * headings, and not required to disambiguate feature (row) names.
   * This can be passed featurePosition() -> featureNameValue() -> featureName()
   */
  singleBlock = blocks.size === 1;

  /** sort features by .value[0] */
  const
  sortedFeatures = createdFeatures
    .filter(featureFilter)
    .sort(featureSortComparator),
  /** Features have Position start (.value[0]) and optional End (.value[1])
   * This value is 2 if any feature has .value[1], otherwise 1.
   */
  valuesMaxLen = sortedFeatures.reduce((result, f) => Math.max(result, f.value.length), 0),
  /** generate valuesMaxLen columns of feature.value[i] . */
  valueColumns = Array.apply(null, Array(valuesMaxLen))
    .map((x, i) => ({
      features : sortedFeatures.map((f) => featurePosition(f, 0)),
      datasetId : {id : ''},
      name : ['Position', 'End'][i]}));
  const blockColourColumns = gtDatasetIds.map((datasetId) => ({
    features : sortedFeatures.map(
      (feature) => (feature.get('blockId.datasetId.id') === datasetId) ?
        featureNameValue(feature, feature.name) : undefined),
    datasetId : {id : ''},
    name : datasetId }));
  const haplotypeColourColumn = 
    {
      features : sortedFeatures.map(featureHaplotype),
      datasetId : {id : ''},
      name : 'LD Block' }; // Haplotype / tSNP
  /** probably displayed as a colour, using numericalDataRenderer. */
  const mafColumn = 
    {
      features : sortedFeatures.map(featureMaf),
      datasetId : {id : ''},
      name : 'MAF' };
  const
  refAltColumns = refAlt
    .map((ra, i) => ({
      features : sortedFeatures.map((f) => featureValuesRefAlt(requestFormat, f, ra)),
      datasetId : {id : ''},
      name : refAltHeadings[i]}));

  const leftColumns = blockColourColumns.concat(valueColumns, mafColumn, haplotypeColourColumn, refAltColumns);

  let sampleNamesForTable = ! options.userSettings.haplotypeFiltersEnable ? sampleNames : sampleNames
    /* alternatively, could filter sampleName after : if (featuresMatchSample),
     * at that point block is known; this is probably more efficient. */
    .filter((sampleName) => ! sampleIsFilteredOutBlocks(blocksArray, sampleName, sampleFilter));
  if (sampleNamesCmp) {
    sampleNamesForTable = sampleNamesForTable
      .sort(sampleNamesCmp);
  }
  const
  displayData = sampleNamesForTable
    .reduce((result, sampleName) => {
    /** if any features of a block contain sampleName, then generate a
     * block:sampleName column, with all features of all blocks, in
     * feature.value[0] order - empty where block has no feature.
     */
    for (const block of blocksArray) {
      /** blocks : features : samples
       * maybe filter by sampleName.
       * each column is identified by block + sampleName, and has features of that block with that sampleName
       */
      let
      /** count of features with .values[sampleName] */
      featuresMatchSample = 0,
      /** could map block to an array of samples which its features have, enabling
       * column order by block. */
      features = sortedFeatures
        .map((f) => {
        let
          sampleValue = Ember_get(f, 'values.' + sampleName),
          refAltValues = refAlt
            .map((ra, i) => f.values[refAlt[i]]),
          valueInFormat = valueToFormat(requestFormat, refAltValues, sampleValue),
          fx = featureForMatrixColumn(f, sampleName, valueInFormat, {requestFormat, singleBlock});
        if ((f.get('blockId.id') === block.get('id')) && (sampleValue !== undefined)) {
          featuresMatchSample++;
        }
        return fx;
      });
      if (featuresMatchSample) {
        let
        column = blockToMatrixColumn(singleBlock, block, sampleName, features);
        result.push(column);
      }
    };
    return result;
  }, leftColumns);
  dLog(fnName, displayData);
  return displayData;
}

function valueIsCopies(alleleValue) {
  return alleleValue?.match(/^[012]/);
}

const missingValues = ['./.', '.|.', '', undefined];
function valueIsMissing(valueIn) {
  const missing = missingValues.includes(valueIn);
  return missing;
}


/** convert valueIn to requestFormat, if not already in that format.
 * @param requestFormat 'CATG', 'Numerical', ...
 * @param refAltValues  [refValue, altValue]
 * @param valueIn sampleValue.  possible values :
 *  undefined
 *  'A' 'C' 'T' 'G' '0' '1' '2'
 *  '0/1' '1/0' './.' 
 *  or matching /^[ACTG][/|][ACTG]$/, the 2 allele values are different.
 * @return string value  in requestFormat
 */
function valueToFormat(requestFormat, refAltValues, valueIn) {
  const
  fnName = 'valueToFormat';
  let valueOut;
  if (valueIsMissing(valueIn)) {
    valueOut = valueIn;
  } else {
    const
    alleles = valueIn.split(/[/|]/),
    separator = (alleles?.length === 2) && valueIn[2],
    // alleles = valueIn.match(/^\([012CATG]\)[/|]\([012CATG]\)/),
    formatIsNumeric = valueIsCopies(valueIn);
    //      cellIsCATG = value.match(/[CATG]/),

    if (formatIsNumeric && (requestFormat === 'CATG')) {
      // convert Numerical to CATG
      if (alleles?.length === 2) {
        /**  valueIn matches /^[01][/|][01]$/; alleles[*] are both [01] */
        valueOut = alleles.map((a) => refAltValues[+a])
          .join(separator);
      } else {
        // handle valueIn : '0' or '2', and the end part of '1'
        valueOut = refAltValues[+(+valueIn > 0)];
        if (valueIn === '1') {
          /** map '1' to '<Ref>/<Alt>'
           * refAltValues[] indices of ref, alt are : 0, 1.
           */
          valueOut = refAltValues[0] + '/' + valueOut;
        }
      }
    } else if (! formatIsNumeric && (requestFormat === 'Numerical')) {
      // convert CATG to Numerical
      const altValue = refAltValues[+true];
      if (alleles?.length === 2) {
        /** valueIn matches /^[ACTG][/|][ACTG]$/
         * instead of mapping to '0/1' or '1/0', may go direct to '1'
         * .join() converts number/s to string
         */
        valueOut = alleles.map((a) => +(a === altValue))
          .join(separator);
      } else {
        // valueIn matches /^[ACTG]/
        valueOut = (valueIn === altValue) ? '2' : '0';
      }
    } else {
      valueOut = valueIn;
    }
  }
  if (trace > 3) {
    dLog(fnName, requestFormat, refAltValues, valueIn, valueOut);
  }

  return valueOut;
}

function featureForMatrixColumn(f, sampleName, sampleValue, formatOptions) {
  const
  requestFormat = formatOptions.requestFormat,
  value = requestFormat ? sampleValue : matchExtract(sampleValue, /^([^:]+):/, 1);
  singleBlock = formatOptions.singleBlock;
  const
  /** equivalent : featureNameValue(f, value) */
  name = featureName(/*formatOptions.singleBlock,*/ f);
  let
  fx = {name, value};
  fx[featureSymbol] = f;
  return fx;
}

function blockToMatrixColumn(singleBlock, block, sampleName, features) {
  const
  showDatasetAndScope = ! singleBlock && block,
  datasetId = showDatasetAndScope ? Ember_get(block, 'datasetId.id') : '',
  /** Now that dataset colour block is displayed, via col-Dataset- in colHeaders(), 
   * dataset and scope are not included in name.
   * gtMergeRows:true displays the dataset colour block regardless of singleBlock,
   * so for consistency one of these should change.
   */
  name = /*(showDatasetAndScope ? Ember_get(block, 'name') + ' ' : '') +*/ sampleName,
  column = {features,  datasetId : {id : datasetId}, name};
  return column;
}

/**
 * @param features block.featuresInBrush
 * (may call this function once with features of all blocks (brushedVCFBlocks) )

 * brushedVCFBlocks.reduce ( block.featuresInBrush.reduce() )

 * @param featureFilter filter applied to featuresArrays[*]
 * @param sampleFilters array of optional additional filters (selected sample, callRate filter)
 * @param options { userSettings }
 * @return result : {rows, sampleNames}
 */
function vcfFeatures2MatrixViewRows(
  requestFormat, featuresArrays, featureFilter, sampleFilters, sampleNamesCmp, options) {
  const fnName = 'vcfFeatures2MatrixViewRows';
  const result = featuresArrays.reduce((res, features, datasetIndex) => {
    res = vcfFeatures2MatrixViewRowsResult(
      res, requestFormat, features, featureFilter, sampleFilters, sampleNamesCmp, options, datasetIndex);
    return res;
  }, {rows : [], sampleNames : []});
  return result;
}
/** Similar to vcfFeatures2MatrixView(), but merge rows with identical position,
 * i.e. implement options.gtMergeRows
 * @param features block.featuresInBrush. one array, one block.
 * @param featureFilter filter applied to features
 * @param sampleFilters array of optional additional filters (selected sample, callRate filter)
 * @param sampleNamesCmp undefined, or a comparator function to sort sample columns
 * @param options { userSettings }
 * @param datasetIndex index of this dataset in the featuresArrays passed to vcfFeatures2MatrixViewRows().
 * @param result : {rows, sampleNames}. function can be called via .reduce()
 */
function vcfFeatures2MatrixViewRowsResult(
  result, requestFormat, features, featureFilter, sampleFilters,
  sampleNamesCmp, options, datasetIndex) {
  const fnName = 'vcfFeatures2MatrixViewRowsResult';
  const
  userSettings = options.userSettings,
  optionsMAF = {
    requestSamplesAll : userSettings.requestSamplesAll,
    selectedSamples : options.selectedSamples};
  const showHaplotypeColumn = features.length && features[0].values.tSNP;
  const block = features.length && contentOf(features[0].blockId);
  const
  dataset = block?.get('datasetId'),
  datasetId = dataset?.get('id'),
  enableFeatureFilters = dataset.get('enableFeatureFilters');

  let sampleNamesSet = new Set();

  // result =
  features.reduce(
    (res, feature) => {
      if (! enableFeatureFilters || featureFilter(feature)) {
        featureSampleMAF(feature, optionsMAF);
        const
        row = rowsAddFeature(res.rows, feature, 'Name', 0);
        if (showHaplotypeColumn) {
          // column name is 'LD Block', originally  'Haplotype'.
          row['LD Block'] = stringSetFeature(featureHaplotypeValue(feature), feature);
        }

        /* If sampleName is ref/alt, convert to Title Case, i.e. leading capital.
         * related to refAltColumns */
        function caseRefAlt(sampleName) {
          if (refAlt.includes(sampleName)) {
            sampleName = toTitleCase(sampleName);
          }
          return sampleName;
        }
        if (options.userSettings.haplotypeFiltersEnable) {
          sampleFilters.push((block, sampleName) => ! sampleIsFilteredOut(block, sampleName));
        }
        /** caseRefAlt is a map function and sampleFilters (including sampleIsFilteredOut) are filter functions.
         * related : sampleNamesForTable */
        let filterFn =
            (sampleName) => 
            sampleFilters.every(fn => fn(block, sampleName)) &&
            caseRefAlt(sampleName);

        // can instead collate columnNames in following .reduce(), plus caseRefAlt().
        /* unchanged */ /* sampleNamesSet = */
        featureSampleNames(sampleNamesSet, feature, filterFn);

        const
        /** for valueToFormat(); the same is done in vcfFeatures2MatrixView() */
        refAltValues = refAlt
          .map((ra, i) => feature.values[refAlt[i]]),
        featureSamples = feature.get('values');

        Object.entries(featureSamples)
          .filter(
            ([sampleName, sampleValue]) =>
              sampleFilters.every(fn => fn(block, sampleName))
          )
          // .filter(([sampleName, sampleValue]) => ! ['tSNP', 'MAF'].includes(sampleName))
          .reduce(
          (res2, [sampleName, sampleValue]) => {
            let columnName;
            /** overlap with caseRefAlt(). */
            if (refAlt.includes(sampleName)) {
              sampleValue = featureValuesRefAlt(requestFormat, feature, sampleName);
              // the capital field name is used in : row[sampleName]
              sampleName = toTitleCase(sampleName);
            } else {
              columnName = sampleName = sampleName2ColumnName(sampleName);
              /** Convert sample values to requestFormat; don't convert
               * non-sample values such as tSNP, MAF.
               * May move sample values to form Feature.values.samples{}, which
               * will make it simpler to apply distinct treatments to these. */
              if (! ['tSNP', 'MAF'].includes(sampleName)) {
                sampleValue = valueToFormat(requestFormat, refAltValues, sampleValue);
              }
            }
            const 
            // featureNameValue(feature, sampleValue),
            fx = stringSetFeature(sampleValue, feature),
            // devel - checking value in console
            r = row[sampleName];
            /** for multiple features in a cell */
            if (cellMultiFeatures) {
              const
              cell = (row[sampleName] ||= []);
              cell.push(fx);
            } else {
              sampleName = columnNameAppendDatasetId(sampleName, datasetId);
              row[sampleName] = fx;
            }
            return res2;
          }, res);
      }
      return res;
    },
    result);

  //----------------------------------------------------------------------------

  /** Used as a .sort() comparator function.
   * Order the given list of column names to match columnOrder[] if both column
   * names are in columnOrderIndex[]; use sampleNamesCmp() if neither are,
   * otherwise 0 : no order.
   * @param n1, n2 column names, which may be sample names.
   */
  function columnNamesCmp(n1, n2) {
    const
    i1 = columnOrderIndex[n1],
    i2 = columnOrderIndex[n2],
    d1 = (i1 !== undefined),
    d2 = (i2 !== undefined),
    result = d1 && d2 ? i1 - i2 :
      (d1 !== d2 || ! sampleNamesCmp) ? 0 :
      sampleNamesCmp(n1, n2);

    return result;
  }

  //----------------------------------------------------------------------------
  
  const
  /** construct column names from the samples names accumulated from feature values.
   *
   * Omit Ref/Alt if datasetIndex > 0, i.e. assume SNPs are bi-allelic so Ref / Alt
   * from each dataset will be the same.
   * map 'tSNP' to 'LD Block' in columnNames, not in the row data. related : Haplotype.
   *
   * Annotate the column name with dataset; this could be block; handling
   * multiple blocks of one dataset is not envisaged ATM, so it is not known
   * whether they should be separate columns, which would favour annotating with
   * block here.  This value is used in matrix-view : colHeaders().
   */
  columnNames = Array.from(sampleNamesSet.keys())
    .filter(name => (datasetIndex === 0) || ! refAltHeadings.includes(name))
    .map(sampleName2ColumnName)
    .sort(columnNamesCmp)
    .map((name) => columnNameAppendDatasetId(name, datasetId))
    .map(name => stringSetSymbol(datasetSymbol, name, dataset));
  result.sampleNames.addObjects(columnNames);

  dLog(fnName, result.rows.length);
  return result;
}

/** Add feature to rows[]
 * @param rows array indexed by .Position (feature.value[0])
 * @param feature models/feature
 * @param nameColumn  'Name' or datasetId, for feature from non-VCF data block
 * @param valueIndex use .value[valueIndex] for position, default 0
 * If valueIndex is 1 (end position), prefix name with '- '
 */
function rowsAddFeature(rows, feature, nameColumn, valueIndex = 0) {
  const
  position = feature.get('value.' + valueIndex),
  row = (rows[position] ||= ({})),
  datasetId = feature.get('blockId.datasetId.id');  // .mapName
  /* related to vcfFeatures2MatrixView() : blockColourColumns,
   * Until 53c7c59f these set cell value to featureBlockColourValue(feature),
   * now replaced by feature.name
   */
  /* Originally (until 53c7c59f) single row.Block column, now 1 .name column per
   * VCF dataset, as with the non-VCF datasets datasetColumns.
   */
  row[datasetId] = stringSetFeature(feature.name, feature);
  let name = feature.name;
  if (valueIndex) {
    name = '- ' + name;
  }
  row[nameColumn] = stringSetFeature(name, feature);
  /* row.Position is used by matrix-view : rowHeaders(), not in a named column. */
  row.Position = position;
  return row;
}


/** Annotate each row which the given features overlap.
 * This is used to annotate VCF merged rows (possibly multiple SNPs)
 * with non-VCF features.
 * Features with only .value[0] or .value[0]===.value[1] i.e. 0-length features
 * are only annotated if there is a row at Position .value[0].
 * @param rows sparse array, indexed by feature.value[*]
 * @param features [] of non-VCF feature
 * @param selectedFeaturesValuesFields 
 */
function annotateRowsFromFeatures(rows, features, selectedFeaturesValuesFields) {
  const
  fnName = 'annotateRowsFromFeatures',
  p1 = performance.mark('p1'),
  intervals = featuresIntervalsForTree(features),
  p2 = performance.mark('p2'),
  /** Build tree */
  intervalTree = createIntervalTree(intervals);
  const p3 = performance.mark('p3');
  let duration_12 = 0, measure_12;

  /** rows is sparse; rows.forEach() is slow; Object.entries(rows).forEach() is OK.  */
  Object.entries(rows).forEach(([location, row]) => {
    const p_1 = performance.mark('p_1');
    /** Find all intervals containing query point */
    intervalTree.queryPoint(location, function(interval) {
      const
      feature = interval[featureSymbol],
      datasetId = feature.get('blockId.datasetId.id');

      rowAddFeatureField(row, feature, datasetId, feature.name);

      const fields = selectedFeaturesValuesFields[datasetId];
      if (fields) {
        /* features within a block could overlap, so cell value is an array of Strings.
         * Also, field names might overlap between multiple non-VCF blocks
         * brushed (they would not conflict if the column name was different per
         * dataset).
         */
        fields.forEach((fieldName) => rowAddFeatureField(row, feature, fieldName, feature.values[fieldName]));
      }
    });
    const p_2 = performance.mark('p_2');
    if (! measure_12) {
      measure_12 = performance.measure('p_1-p_2', 'p_1', 'p_2');
    }
    duration_12 += measure_12.duration;
  });
  const
  p4 = performance.mark('p4'),
  measure12 = performance.measure('p1-p2', 'p1', 'p2'),
  measure23 = performance.measure('p2-p3', 'p2', 'p3'),
  measure34 = performance.measure('p3-p4', 'p3', 'p4');
  console.log(
    fnName, 
    '#rows', Object.keys(rows).length,
    '#features', features.length,
    '_12', duration_12,
    '12', measure12.duration,
    '23', measure23.duration,
    '34', measure34.duration,
  );
}

/**
 * @param fieldName used to index row{}
 * @param value feature.name or feature.values[fieldName]
 */
function rowAddFeatureField(row, feature, fieldName, value) {
  /** Putting Feature[] in the table cell data led HandsOnTable to try to
   * render Feature.store, ._internalModel etc and get into an infinite
   * recursion when the Feature was e.g. HC genes (no error with 90k and 40k
   * markers, which are also loaded from the API; they are less dense and
   * have single-location whereas genes have intervals).
   *
   * The solution used is to put Feature.name [] into the cell data, using
   * new String() so that it can refer to the Feature via [featureSymbol].
   * It would be possible to put a feature proxy into the data providing
   * only the required fields (.name, ...), but it would be similar memory &
   * time use, and more complex.
   */

  const
  rowDatasetFeatures = row[fieldName] || (row[fieldName] = []),
  featureString = stringSetFeature(value, feature);
  rowDatasetFeatures.push(featureString);
}

/** @return [datasetId] -> Set of field names of features[*].values{}, 1 Set per datasetId.
 * @param features array of non-VCF features, i.e. features[*].values are not samples
 */
function featuresValuesFields(features) {
  let
  fnName = 'featuresValuesFields',
  fieldsSets = features.reduce((sets, feature) => {
    const
    datasetId = feature.get('blockId.datasetId.id'),
    set = sets[datasetId] || (sets[datasetId] = new Set());
    if (feature.values) {
      Object.keys(feature.values).forEach((fieldName) => set.add(fieldName));
    }
    return sets;
  }, {});
  return fieldsSets;
}


/** Collate "sample names" i.e. keys(feature.values), adding them to sampleNamesSet.
 * Omit ref and alt, i.e. names which are in refAlt.
 * @param sampleNamesSet new Set() to accumulate sampleNames
 * @param feature
 * @param filterFn  if defined, process names, and if result is not undefined, add it to set.
 * i.e. filterFn can play the role of both a map function and a filter function
 * @return sampleNamesSet, for use in .reduce().
 */
function featureSampleNames(sampleNamesSet, feature, filterFn) {
  const
  featureSamples = feature.get('values');
  Object.entries(featureSamples).reduce(
    (sampleNamesSet, [sampleName, sampleValue]) => {
      if (filterFn) {
        sampleName = filterFn(sampleName);
      }
      if (sampleName) {
        sampleNamesSet.add(sampleName);
      }
      return sampleNamesSet;
    },
    sampleNamesSet);

  return sampleNamesSet;
}


//------------------------------------------------------------------------------

/** Calculate sample MAF for features.
 */
function featuresSampleMAF(features, options) {
  features.forEach(feature => featureSampleMAF(feature, options));
}
/** Calculate sample MAF for feature, for the loaded samples, either selected or
 * all samples.
 * Update feature.values.MAF, replacing any value read from the API request.
 */
function featureSampleMAF(feature, options) {
  const
  fnName = 'featuresSampleMAF',
  { selectedSamples,  requestSamplesAll } = options,
  /** Germinate does not contain alt/ref; could determine by count. */
  alt = feature.values.alt;
  if ((requestSamplesAll || selectedSamples) && alt) {
    const
    counts = Object.entries(feature.values)
      .reduce((sum, [sampleName, value]) => {
        if (! valueNameIsNotSample(sampleName) &&
            (requestSamplesAll || selectedSamples.includes(sampleName))) {
          // skip missing data : './.' or '.|.'
          if (value[0] !== '.' ) {
            // assumes diploid values
            sum.count += 2;
            sum.copies += copiesOfAlt(value, alt);
          }
        }
        return sum;
      }, {count : 0, copies : 0}),
    maf = counts.count ? counts.copies / counts.count : undefined;
    // dLog(fnName, maf, counts);
    if (maf !== undefined) {
      feature.values.MAF = maf;
    }
    /* possibly : else if (feature.values.MAF !== undefined) { delete feature.values.MAF ; }
     * tried setting undefined or null - "undefined" is shown in table,
     * and null breaks stringSetFeature() -> stringSetSymbol().
     */
  }
}

/** Count the copies of Alt in the given genotype value.
 * @param value string  genotype value.
 * Either numeric or nucleotide representation.
 * Either 1 or 2 values; 2 values are separated by | or /.
 * @param alt string. 1 char. Nucleotide representation of the Alternate allele.
 */
function copiesOfAlt(value, alt) {
  const fnName = 'copiesOfAlt';
  let copies;
  if ((typeof value !== 'string') ||
      ! (value.length == 1 || value.length == 3)) {
    dLog('fnName', value, alt);
  } else {
    if (/^[012]/.test(value)) {
      // numeric
      if (value.length === 1) {
        copies = +value;
      } else {
        copies = +value[0] + value[2];
      }
    } else {
      // nucleotide
      copies = stringCountString(value, alt);
      if (value.length === 1) {
        copies *= 2;
      }
    }
  }
  return copies;
}

//------------------------------------------------------------------------------

/** Support a repeated storage pattern : object[symbol][fieldName] is an array.
 */
function objectSymbolNameArray(object, symbol, fieldName) {
  // equivalent : object = contentOf(object);
  if (object.content) {
    object = object.content;
  }
  const
  arrays = object[symbol] || (object[symbol] = {}),
  array = arrays[fieldName] || (arrays[fieldName] = Ember_A());
  return array;
}
function objectSymbol(object, symbol) {
  if (object.content) {
    object = object.content;
  }
  const
  arrays = object[symbol] || (object[symbol] = {});
  return arrays;
}

/** possible alternative to CP get variantSets().
 * usage :
 * for viewed VCF blocks
 *  for selected variantIntervals
 *    getVariantSet(variantInterval, block)
 *
 * @param variantInterval feature of dataset with tag 'variantInterval'
 * @param block VCF block
 * @return array of features : SNPs in block which are within variantInterval.value
 */
function getVariantSet(variantInterval, block) {
  /* filter block features; store result in block[symbol][vi-name]   */
  const
  fnName = 'getVariantSet',
  features = block.get('features').toArray()
    .filter(feature => intervalsIntersect(feature.value, variantInterval.value)),
  variantIntervalName = variantInterval.value.join('-'),
  sets = objectSymbol(block, variantSetSymbol);
  // i.e. block[variantSetSymbol][variantIntervalName] = features;
  sets[variantIntervalName] = features;
  return features;
}
/**
 * block  VCF / genotype block
 * @return [] of SNP feature in
 */
 function blockVariantSets(block) {
   return 
  }

/** Variant Sets.
 * The result of intersecting a Variant Interval with a VCF block.
 * block[variantSetSymbol][variantIntervalName] is an array of features of block which overlap the named variantInterval.
 */
const variantSetSymbol = Symbol.for('variantSet');

//------------------------------------------------------------------------------


export {
  refAlt,
  valueNameIsNotSample,
  datasetId2Class,
  gtValueIsNumeric,
  addGerminateOptions,
  vcfGenotypeLookup,
  addFeaturesJson,
  resultIsGerminate,
  addFeaturesGerminate,
  featureBlockColourValue,
  sampleIsFilteredOut,
  sampleName2ColumnName,
  columnNameAppendDatasetId,
  columnName2SampleName,
  vcfFeatures2MatrixView, vcfFeatures2MatrixViewRows,
  valueIsCopies,
  valueIsMissing,
  rowsAddFeature,
  annotateRowsFromFeatures,
  featuresValuesFields,
  featureSampleNames,
  featuresSampleMAF,
  featureSampleMAF,
  objectSymbolNameArray,
};
