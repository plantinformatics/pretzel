import { get as Ember_get, set as Ember_set } from '@ember/object';
import { A as Ember_A } from '@ember/array';

import { toTitleCase } from '../string';
import { stringGetFeature, stringSetFeature } from '../panel/axis-table';

// -----------------------------------------------------------------------------

const dLog = console.debug;

const trace = 1;

const featureSymbol = Symbol.for('feature');

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

/** for multiple features in a cell, i.e. merge rows - multiple features at a
 * position from different vcf datasets; could also merge columns (samples).  */
const cellMultiFeatures = false;


// -----------------------------------------------------------------------------

/** Lookup the genotype for the selected samples in the interval of the brushed block.
 * @param auth  auth service for ajax
 * @param server store to add the features to
 * @param samples to request, may be undefined or []
 * @param domainInteger  [start,end] of interval, where start and end are integer values
 * @param requestFormat 'CATG' (%TGT) or 'Numerical' (%GT for 01)
 * @param vcfDatasetId  id of VCF dataset to lookup
 * @param scope chromosome, e.g. 1A, or chr1A - match %CHROM chromosome in .vcf.gz file
 * @param rowLimit
 */
function vcfGenotypeLookup(auth, server, samples, domainInteger, requestFormat, vcfDatasetId, scope, rowLimit) {
  const
  fnName = 'vcfGenotypeLookup',

  region = scope + ':' + domainInteger.join('-'),
  preArgs = {region, samples, requestFormat};
  // parent is .referenceDatasetName

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
  textP = auth.vcfGenotypeLookup(server, vcfDatasetId, scope, preArgs, rowLimit, {} )
    .then(
      (textObj) => {
        const text = textObj.text;
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
   * have a trailing \n, and is discarded.
   * Otherwise values.length may be < 4, and feature.value may be undefined.
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
    dLog(fnName, 'discarding', lines[lines.length-1]);
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
        // overridden in the switch default.
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
          value = [ +value ];
          f['value_0'] = value;
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
          let prefix = fieldNameF.match(/^(.+)\..*/);
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
            /* could use Ember_set() for both cases. */
            Ember_set(f, fieldNameF, value);
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
       * part can factor out as a separate function, returning an array of of
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

        createdFeatures.push(feature);
        selectionFeatures.push(selectionFeature);
        block.features.addObject(feature);
      }

    }
  });
  selectedFeatures.pushObjects(selectionFeatures);
  block.set('featureCount', block.get('features.length'));


  if (! columnNames || ! sampleNames) {
    dLog(fnName, lines.length, text.length);
  }

  let result = {createdFeatures, sampleNames};
  return result;
}

// -----------------------------------------------------------------------------

/** Merge feature.values into existingFeature.values
 */
function mergeFeatureValues(existingFeature, feature) {
  Object.entries(feature.values).forEach((e) => {
    if (existingFeature.values[e[0]] !== e[1]) {
      console.log(feature.id, existingFeature.values[e[0]] ? 'setting' : 'adding', e);
      existingFeature.values[e[0]] = e[1];
    }
  });
}

// -----------------------------------------------------------------------------

/** if string.match(regexp), return match[valueIndex], otherwise undefined. 
 */
function matchExtract(string, regexp, valueIndex) {
  let match = string.match(regexp),
      value = match && match[valueIndex];
  return value;
}

function featureName(feature) {
  /** Use first 5 chars of datasetId; will remove this from left column,
   * but retain prefix for uniqueness until row merging is implemented.
   */
  let name = feature.get('blockId.brushName').slice(0, 5) + ' ' + feature.name;
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
 *
 * @return displayData
 */
function vcfFeatures2MatrixView(requestFormat, added) {
  const fnName = 'vcfFeatures2MatrixView';
  /** createdFeatures : array of model:Feature (could be native JS objects - see
   * comment in addFeaturesJson() */
  let {createdFeatures, sampleNames} = added;
  /** The param added.createdFeatures could be grouped by block.
   * Ordering by sampleName seems more useful, although not clear how often sampleName appears in 2 blocks.
   */
  const blocks = createdFeatures.reduce((result, feature) => {
    result.set(feature.get('blockId.content'), true);
    return result;
  }, new Map());

  /** sort features by .value[0] */
  const
  sortedFeatures = createdFeatures
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
  const blockColourColumn = 
    {
      features : sortedFeatures.map(featureBlockColour),
      datasetId : {id : ''},
      name : 'Block' };
  const
  refAltColumns = refAlt
    .map((ra, i) => ({
      features : sortedFeatures.map((f) => featureValues(f, ra)),
      datasetId : {id : ''},
      name : refAltHeadings[i]}));

  const leftColumns = [blockColourColumn].concat(valueColumns, refAltColumns);

  let displayData = sampleNames.reduce((result, sampleName) => {
    /** if any features of a block contain sampleName, then generate a
     * block:sampleName column, with all features of all blocks, in
     * feature.value[0] order - empty where block has no feature.
     */
    for (const block of blocks.keys()) {
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
          fx = featureForMatrixColumn(f, sampleName, sampleValue, requestFormat);
        if ((f.get('blockId.id') === block.get('id')) && (sampleValue !== undefined)) {
          featuresMatchSample++;
        }
        return fx;
      });
      if (featuresMatchSample) {
        let
        column = blockToMatrixColumn(block, sampleName, features);
        result.push(column);
      }
    };
    return result;
  }, leftColumns);
  dLog(fnName, displayData);
  return displayData;
}

function featureForMatrixColumn(f, sampleName, sampleValue, requestFormat) {
  const
  value = requestFormat ? sampleValue : matchExtract(sampleValue, /^([^:]+):/, 1),
  /** equivalent : featureNameValue(f, value) */
  name = featureName(f);
  let
  fx = {name, value};
  fx[featureSymbol] = f;
  return fx;
}

function blockToMatrixColumn(block, sampleName, features) {
  const
  datasetId = block ? Ember_get(block, 'datasetId.id') : '',
  name = (block ? Ember_get(block, 'name') + ' ' : '') + sampleName,
  column = {features,  datasetId : {id : datasetId}, name};
  return column;
}

/**
 * @param features block.featuresInBrush
 * (may call this function once with features of all blocks (brushedVCFBlocks) )

 * brushedVCFBlocks.reduce ( block.featuresInBrush.reduce() )

 * @return result : {rows, sampleNames}
 */
function vcfFeatures2MatrixViewRows(requestFormat, featuresArrays) {
  const fnName = 'vcfFeatures2MatrixViewRows';
  const result = featuresArrays.reduce((res, features) => {
    res = vcfFeatures2MatrixViewRowsResult(res, requestFormat, features);
    return res;
  }, {rows : [], sampleNames : []});
  return result;
}
/**
 * @param features block.featuresInBrush. one array, one block.
 * @param result : {rows, sampleNames}. function can be called via .reduce()
 */
function vcfFeatures2MatrixViewRowsResult(result, requestFormat, features) {
  const fnName = 'vcfFeatures2MatrixViewRows';

  let sampleNamesSet = new Set();

  // result =
  features.reduce(
    (res, feature) => {
      const
      position = feature.get('value.0'),
      row = (res.rows[position] ||= {}),
      blockColourValue = featureBlockColourValue(feature);
      /* related to vcfFeatures2MatrixView() : blockColourColumn,  */
      row.Block = stringSetFeature(blockColourValue, feature);
      row.Name = stringSetFeature(feature.name, feature);
      const
      featureSamples = feature.get('values');
      Object.entries(featureSamples).reduce(
        (res2, [sampleName, sampleValue]) => {
          /* related to refAltColumns */
          function caseRefAlt(sampleName) {
            if (refAlt.includes(sampleName)) {
              sampleName = toTitleCase(sampleName);
            }
            return sampleName;
          }
          featureSampleNames(sampleNamesSet, feature, caseRefAlt);
          const 
          // featureNameValue(feature, sampleValue),
          fx = stringSetFeature(sampleValue, feature),
          r = row[sampleName];
          /** for multiple features in a cell */
          if (cellMultiFeatures) {
            const
            cell = (row[sampleName] ||= []);
            cell.push(fx);
          } else {
            row[sampleName] = fx;
          }
          return res2;
        }, res);
      return res;
    },
    result);

  result.sampleNames.addObjects(Array.from(sampleNamesSet.keys()));

  dLog(fnName, result.rows.length);
  return result;
}

/** Collate "sample names" i.e. keys(feature.values), adding them to sampleNamesSet.
 * Omit ref and alt, i.e. names which are in refAlt.
 * @param feature
 * @param filterFn  if defined, process names, and if result is not undefined, add it to set.
 * @param sampleNamesSet new Set() to accumulate sampleNames
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


// -----------------------------------------------------------------------------


export {
  refAlt,
  vcfGenotypeLookup,
  addFeaturesJson, vcfFeatures2MatrixView, vcfFeatures2MatrixViewRows,
  featureSampleNames,
};
