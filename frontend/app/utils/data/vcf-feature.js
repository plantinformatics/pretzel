import { get as Ember_get, set as Ember_set } from '@ember/object';

import { A as Ember_A } from '@ember/array';

//------------------------------------------------------------------------------

import createIntervalTree from 'interval-tree-1d';

import { stringCountString, toTitleCase } from '../string';
import { stringGetFeature, stringSetSymbol, stringSetFeature } from '../panel/axis-table';
import { contentOf } from '../common/promises';
import { featuresIntervalsForTree } from './features';
import { intervalsIntersect, intervalMerge } from '../interval-calcs';
import { Measure } from './genotype-order';

//------------------------------------------------------------------------------

//let vcfGenotypeBrapi = window["vcf-genotype-brapi"];
// console.log('vcfGenotypeBrapi', vcfGenotypeBrapi, window["@plantinformatics/vcf-genotype-brapi@npm:pretzel.A8b"]);
import /*const */ {
  gtValueIsNumeric,
  datasetId2Class,
  addGerminateOptions,
  getDatasetFeaturesCounts,
  vcfGenotypeLookup,
  addFeaturesJson,
  resultIsGerminate,
  addFeaturesGerminate,
  variantNameSplit,
  parseNumber,
  parseNumberFields,
} /*= vcfGenotypeBrapi.vcfFeature; */ from '@plantinformatics/vcf-genotype-brapi';
 /* omitting @plantinformatics/ while using npm pack */
/* /vcf-genotype-brapi/dist/*/
 /* /dist/vcf-genotype-brapi.js */
 /*  @npm:pretzel.A8b   vcf-genotype-brapi or */


//------------------------------------------------------------------------------

/* global performance */

//------------------------------------------------------------------------------

const dLog = console.debug;

const trace = 1;

//------------------------------------------------------------------------------

const datasetSymbol = Symbol.for('dataset');
const passportSymbol = Symbol.for('passport');
const featureSymbol = Symbol.for('feature');
const sampleMatchesSymbol = Symbol.for('sampleMatches');
const callRateSymbol = Symbol.for('callRate');

//------------------------------------------------------------------------------

const refAlt = ['ref', 'alt'];
const refAltHeadings = refAlt.map(toTitleCase);

//------------------------------------------------------------------------------

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

/** Identify those columns which are not sample names.
 * Match both the raw Feature.values key and the Capitalised name which is
 * displayed in the column header (without the trailing "\t" + datasetId).
 * Related : columnNameIsNotSample() (for current usage, these 2 could
 * potentially be merged).
 * INFO is a field of feature.values and is not a sample.
 */
const nonSampleNames = [
  'ref', 'alt', 'tSNP', 'MAF',
  'Ref', 'Alt', 'LD Block',
  'INFO',
];
/** Given a key within Feature.values, classify it as sample (genotype data) or other field.
 */
function valueNameIsNotSample(valueName) {
  return nonSampleNames.includes(valueName);
}

/** Return true if sampleName matches the naming convention for AGG sample / accession names.
 * It is not valid to send a request to Genolink for a genotypeId / sample name
 * / accession name which is not present in Genolink, and the scope of Genolink
 * is the samples in the AGG.
 *
 * For use in : components/matrix-view.js : afterGetColHeaderRows(),
 * components/panel/genotype-samples.js : selectedSamplesGetPassport(),
 * genolinkSearchURL().
 * Used in manage-genotype.js : datasetGetPassportData().
 *
 * @return true or false
 */
export function sampleNameIsAGG(sampleName) {
  return !!sampleName.match(/^AGG/);
}

//------------------------------------------------------------------------------

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
  blockColourValue = axis1d?.blockColourValue(feature.get('blockId'));
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
  const maf = normalizeMaf(feature.get('values.MAF'));
  return maf;
}

/** MAF (Minor Allele Frequency) is conventionally expressed as a number in the
 * range [0, 0.5]
 */
function normalizeMaf(maf) {
  if ((maf !== undefined) && (maf > 0.5)) {
    maf = 1 - maf;
  }
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
    // counts is now Measure, replacing : distance, {matches,mismatches}.
    /** matches may not contain all samples of block, because of samplesLimit. */
    const counts = matches[sampleName];
    /** also done in matrix-view.js : showHideSampleFn() */
    hide = Measure.hide(counts);
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

/** Copy Symbols from source to destination.
 * Used to preserve attributes of sampleName (e.g. dataset, passport, passport
 * fields) as it is formatted to columnName.
 * An alternative is to move sampleName and the other attributes into a sample
 * object, and use this in the various sample pipelines.
 * @param source  Object
 * @param destination Object
 */
function copySymbols(source, destination) {
  for (const symbol of Object.getOwnPropertySymbols(source)) {
    destination[symbol] = source[symbol];
  }
}

function columnNameAppendDatasetId(columnName, datasetId) {
  /** Assume the SNPs are bi-allelic, so only display 1 Ref/Alt
   * regardless of multiple datasets. */
  if (! refAltHeadings.includes(columnName)) {
    const previous = columnName;
    columnName = columnName + '\t' + datasetId;
    /* Copy symbols if param is a String, (e.g. dataset, passport, passport
     * fields) */
    if (previous instanceof String) {
      columnName = new String(columnName);
      copySymbols(previous, columnName);
    }
  }
  return columnName;
}
function columnName2SampleName(columnName) {
  const sampleName = columnName.split('\t')[0];
  return sampleName;
}

/** If selectFields.length, augment the given sample / accession name with selected
 * fields from the Passport data of the accession.
 * @param sampleName
 * @param selectFields	user-selected list of fields to add (userSettings.passportFields)
 * @param datasetId	to lookup the Passport data of the sampleName
 * @param visibleBlocks	for visibleBlocks[].datasetId.samplesPassport
 * which contains the Passport field value for the samples
 */
function sampleNameAddPassport(sampleName, selectFields, datasetId, visibleBlocks) {
  if (selectFields.length && ! valueNameIsNotSample(sampleName)) {
  const 
    block = visibleBlocks.find(b => b.datasetId.id == datasetId),
    dataset = contentOf(block.datasetId);
    if (dataset?.samplesPassport?.[sampleName]) {
      const values = selectFields.map(fieldName => {
        let text = dataset.samplesPassport[sampleName][fieldName];
        /** 'aliases' value is an array of objects; use the .name field  */
        if ((typeof text === 'object') && Array.isArray(text) &&
            (typeof text[0] === 'object')) {
          const
          aliases = text.mapBy('name'),
          /** there is a lot of repetition in aliases[] */
          aliasesUnique = Array.from(new Set(aliases));
          text = aliasesUnique.join(',');
        }
        return text;
      });
      /* The original implementation simply appended the Passport data values to
       * the sampleName, but now nestedHeaders are used to instead display each
       * Passport field in a separate row.
      // sampleName += ' | ' + values.join(', ');
      */
      values.forEach((value, i) => {
        const fieldName = selectFields[i];
        sampleName = stringSetSymbol(Symbol.for(fieldName), sampleName, value);
      });
    }
  }
  return sampleName;
}

/** Compare Passport data values.
 * @param values  [a, b] to compare
 * @return a-b or the equivalent, depending on the type of values.
 */
export function passportValueCompare(values) {
  const
  types = values.map(v => typeof v),
  cmp =
    (types[0] === 'undefined') || (types[1] === 'undefined') ? 0 :
    (types[0] === 'string') && (types[1] === 'string') ?
    values[0].localeCompare(values[1]) :
    (types[0] === 'number') && (types[1] === 'number' ) ?
    (values[0] - values[1]) :
    ! values[0] || ! values[1] ? 0 :
    Array.isArray(values[0]) && Array.isArray(values[1]) ?
    passportValueCompare([values[0][0], values[1][0]]) :
    (types[0] === 'object') && (types[1] === 'object' ) ?
    passportValueCompare(values.mapBy('name')) :
    0;
  return cmp;
}

/** At the last stage of preparing sampleNames for use as column headers they
 * are augmented with Passport data fields (optional) and datasetId.
 */
function augmentSampleName(sampleName, selectFields, datasetId, visibleBlocks) {
  // no change when ! selectFields.length
  sampleName = sampleNameAddPassport(sampleName, selectFields, datasetId, visibleBlocks);
  sampleName = columnNameAppendDatasetId(sampleName, datasetId);
  return sampleName;
}

/** Reverse of augmentSampleName().
 * Related : columnName2SampleName().
 *
 * All this mapping back and forth is not ideal; that would be reduced by a
 * current proposal to move passport fields (and datasetId) into separate rows
 * within the column header; alternately may introduce a sample object exposing
 * these various display forms.
 */
export function augmented2SampleName(augmentedName) {
  const sampleName = (augmentedName.split(' | ')?.[0]) || sampleName;
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
 * @param features block.featuresInBrushOrZoom
 * (may call this function once with features of all blocks (brushedVCFBlocks) )

 * brushedVCFBlocks.reduce ( block.featuresInBrushOrZoom.reduce() )

 * @param featureFilter filter applied to featuresArrays[*]
 * @param sampleFilters array of optional additional filters (selected sample, callRate filter)
 * @param options { userSettings, selectedSamples, visibleBlocks }
 * @return result : {rows, sampleNames}
 */
function vcfFeatures2MatrixViewRows(
  requestFormat, featuresArrays, featureFilter, sampleFilters, sampleNamesCmp, options) {
  const fnName = 'vcfFeatures2MatrixViewRows';
  const result = featuresArrays.reduce((res, features, datasetIndex) => {
    res = vcfFeatures2MatrixViewRowsResult(
      res, requestFormat, features, featureFilter, sampleFilters, sampleNamesCmp, options, datasetIndex);
    return res;
  }, {rows : new Map(), sampleNames : []});
  return result;
}
/** Similar to vcfFeatures2MatrixView(), but merge rows with identical position,
 * i.e. implement options.gtMergeRows
 * @param features block.featuresInBrushOrZoom. one array, one block.
 * @param featureFilter filter applied to features
 * @param sampleFilters array of optional additional filters (selected sample, callRate filter)
 * @param sampleNamesCmp undefined, or a comparator function to sort sample columns
 * @param options { userSettings }
 * @param datasetIndex index of this dataset in the featuresArrays passed to vcfFeatures2MatrixViewRows().
 * @param result : {rows, sampleNames}. function can be called via .reduce()
 * rows is [Map by referenceBlock][position] -> row
 * (it was simply [position] -> row, until ee226f3d)
 * (an alternative to Map : [referenceBlock.datasetId.id][scope] )
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
  /** this is currently a Proxy; could use contentFor(). */
  dataset = block?.get('datasetId'),
  datasetId = dataset?.get('id'),
  enableFeatureFilters = dataset.get('enableFeatureFilters');
  const selectFields = userSettings.passportFields; // useSelectMultiple : .mapBy('id');

  let sampleNamesSet = new Set();

  // result =
  features.reduce(
    (res, feature) => {
      if (! enableFeatureFilters || featureFilter(feature)) {
        if (feature.values.MAF === undefined) {
          featureSampleMAF(feature, optionsMAF);
        }
        const
        referenceBlock = feature.get('blockId.referenceBlock'),
        map = res.rows,
        newArray = [],
        rows = map.get(referenceBlock) || (map.set(referenceBlock, newArray), newArray),
        row = rowsAddFeature(rows, feature, 'Name', 0);
        /* Chr column could be optional, e.g. if ! .brushedOrViewedScope.length
         * .name relates to the genotype database (e.g. VCF), so it may be what
         * users expect to see rather than .scope here.
         */
        row['Chr'] = feature.get('blockId.name');
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
            (sampleName !== 'INFO') &&
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
          .filter(([sampleName, sampleValue]) => sampleName !== 'INFO')
          .reduce(
          (res2, [sampleName, sampleValue]) => {
            let columnName;
            /** overlap with caseRefAlt(). */
            if (refAlt.includes(sampleName)) {
              sampleValue = featureValuesRefAlt(requestFormat, feature, sampleName);
              // the capital field name is used in : row[sampleName]
              sampleName = toTitleCase(sampleName);
            } else {
              /** Convert sample values to requestFormat; don't convert
               * non-sample values such as tSNP, MAF, INFO.
               * May move sample values to form Feature.values.samples{}, which
               * will make it simpler to apply distinct treatments to these.
               * sampleName2ColumnName() renames sampleName tSNP to 'LD Block'
               */
              if (! ['tSNP', 'MAF', 'INFO'].includes(sampleName)) {
                sampleValue = valueToFormat(requestFormat, refAltValues, sampleValue);
              }
              columnName = sampleName = sampleName2ColumnName(sampleName);
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
              sampleName = augmentSampleName(sampleName, selectFields, datasetId, options.visibleBlocks);
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
  columnNamesSorted = Array.from(sampleNamesSet.keys())
    .filter(name => (datasetIndex === 0) || ! refAltHeadings.includes(name))
    .map(sampleName2ColumnName)
    /** passportSymbol is used by : columnNamesCmp() -> sampleNamesCmpField() -> findPassportFields()
     */
     .map(name => {
       const fieldValues = Ember_get(dataset, 'samplesPassport')?.[name];
       if (fieldValues) { name = stringSetSymbol(passportSymbol, name, fieldValues); }
       return name; })
    .sort(columnNamesCmp),
  /* for re-adding passportSymbol, if required.
  fieldValues = columnNamesSorted
    .map(name => Ember_get(dataset, 'samplesPassport')?.[name]),
    */
  columnNames = columnNamesSorted
    // could skip these for non-samples
    .map((name) => augmentSampleName(name, selectFields, datasetId, options.visibleBlocks))
    /* Could re-add passportSymbol via :
    .map((name, i) => stringSetSymbol(passportSymbol, name, fieldValues[i]))
    */
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

/** Add a field of feature to row; roughly row[fieldName].push(value)
 * but value is mapped to a String which references feature.
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

/** Collate field names (keys) of .values of the given features.
 * @return [datasetId] -> Set of field names of features[*].values{}, 1 Set per datasetId.
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
 * Any existing value of feature.values.MAF is preserved, i.e.
 * featureSampleMAF() is not called if (feature.values.MAF === undefined)
 * That is also true in vcfFeatures2MatrixViewRowsResult().
 */
function featuresSampleMAF(features, options) {
  features.forEach(feature =>
    (feature.values.MAF === undefined) && featureSampleMAF(feature, options));
}
/** Calculate sample MAF for feature, for the loaded samples, either selected or
 * all samples.
 * Update feature.values.MAF, replacing any value read from the API request.
 * Related : collateBlockSamplesCallRate(), featureCallRateFilter().
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
      feature.values.MAF = normalizeMaf(maf);
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

export { featureMafFilter };
/** @return truthy iff feature.values.MAF satisfies {mafThreshold, mafUpper}
 * @param mafThreshold, mafUpper are from userSettings.
 * mafUpper may be undefined, default is false.
 */
function featureMafFilter(feature, mafThreshold, mafUpper) {
  const
  MAF = normalizeMaf(feature.values?.MAF),
  /** don't filter datasets which don't have MAF */
  ok = (MAF === undefined) || 
    ((+MAF < mafThreshold) === !!mafUpper);
  return ok;
}

//------------------------------------------------------------------------------

export { featureCallRateFilter };
/** Filter feature by callRateThreshold.
 * Call Rate of feature is read from INFO.CR or 1 - INFO.F_MISSING if defined,
 * otherwise feature[callRateSymbol], which is calculated in
 * collateBlockSamplesCallRate() from sample genotype values in feature.values.
 * @return truthy if Call Rate of feature is >= callRateThreshold
 * @param callRateThreshold is defined
 * @param feature
 */
function featureCallRateFilter(callRateThreshold, feature) {
  let callRate;
  const INFO = feature.values?.INFO;
  if (INFO && ((INFO.F_MISSING !== undefined) || (INFO.CR !== undefined))) {
    callRate = (INFO.CR !== undefined) ? INFO.CR : 1 - INFO.F_MISSING;
  } else {
    const
    sampleCount = feature[callRateSymbol];
    /** OK (filter in) if callRate is undefined because of lack of counts. */
    callRate = sampleCount && (sampleCount.calls + sampleCount.misses) ?
      sampleCount.calls / (sampleCount.calls + sampleCount.misses) :
      undefined;
  }
  const ok = ! callRate || (callRate >= callRateThreshold);
  return ok;
}

//------------------------------------------------------------------------------

export {featuresFilterNalleles};
/** Filter features by the number of alleles in .values Ref and Alt.
 * @param minAlleles, maxAlleles string from text input, in which the user is
 * expected to enter a number.  ' ' is equivalent to 0.
 * As in featureSatisfiesNalleles() : {min,max}Alleles may be undefined or ''
 * indicating no constraint.
 */
function featuresFilterNalleles(features, minAlleles, maxAlleles) {
  const fnName = 'featuresFilterNalleles';
  dLog(fnName, minAlleles, maxAlleles, features.length);
  features = features.filter(f => featureSatisfiesNalleles(f, minAlleles, maxAlleles));
  dLog(fnName, features.length);
  return features;
}

/** @return true if feature satisfies any constraints defined by minAlleles and maxAlleles.
 * @param minAlleles, maxAlleles  non-negative integer in string format.
 * may be undefined or '' indicating no constraint.
 */
function featureSatisfiesNalleles(feature, minAlleles, maxAlleles) {
  const ok =
    ((minAlleles === undefined) || (minAlleles === '') || (minAlleles <= feature.nAlleles)) &&
      ((maxAlleles === undefined) || (maxAlleles === '') || (feature.nAlleles <= maxAlleles));
  return ok;
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
   return; // draft, may be not required
  }

/** Variant Sets.
 * The result of intersecting a Variant Interval with a VCF block.
 * block[variantSetSymbol][variantIntervalName] is an array of features of block which overlap the named variantInterval.
 */
const variantSetSymbol = Symbol.for('variantSet');


//------------------------------------------------------------------------------
/** Determine if any of the genotype SNP Filters in the given userOptions define
 * filters, i.e. are active.
 * @return true if any of the filters in userOptions have a value.
 * @param userOptions may be from fcResult.userOptions or
 * controls.genotypeSNPFilters which are extracted from userSettings.genotype
 */
function genotypeSNPFiltersDefined(userOptions) {
  const
  /** a filter is active if its value satisfies :
   *   (v !== undefined) && (v !== false) && (v !== 0) && (v !== '')
   * which is effectively implemented by !!v
   * minAlleles and maxAlleles have string values, and '0' is active, and !!'0' is true.
   * whereas the other numeric values (mafUpper, mafThreshold, featureCallRateThreshold)
   * are in-active when 0, and !!0 is false.
   */
  active = Object.values(userOptions).find(v => !!v);
  return active;
}

export { genotypeSNPFiltersApply };
/** Apply any filters defined in userOptions to feature.
 * - snpPolymorphismFilter, mafUpper, mafThreshold, mafUpper, featureCallRateThreshold,
 * - isecDatasetIds, isecFlags
 * - minAlleles, maxAlleles
 * @return truthy iff the feature is filtered in, i.e. satisfies the filter thresholds
 */
function genotypeSNPFiltersApply(userOptions, feature) {
  let ok = true;
  // these filters are passed in request : vcfGenotypeLookupDataset()

  /* to implement snpPolymorphismFilter : factor from manage-genotype.js :
   * snpPolymorphismFilter().
   * can store counts in feature[Symbol.for('countsRefAlt')];  related : copiesOfAlt()
   */

  ok &&= featureMafFilter(feature, userOptions.mafThreshold, userOptions.mafUpper);
  if (userOptions.featureCallRateThreshold) {
    ok &&= featureCallRateFilter(userOptions.featureCallRateThreshold, feature);
  }

  /* perhaps implement some equivalent of this :
      if (intersection) {
        requestOptions.isecDatasetIds = intersection.datasetIds;
        requestOptions.isecFlags = '-n' + intersection.flags;
      }
  */

  if (userOptions.minAlleles || userOptions.maxAlleles) {
    ok &&= featureSatisfiesNalleles(feature, userOptions.minAlleles, userOptions.maxAlleles);
  }

  // not yet implemented :  typeSNP

  return ok;
}

//------------------------------------------------------------------------------


export {
  refAlt,

  valueNameIsNotSample,

  featureBlockColourValue,
  normalizeMaf,
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
  genotypeSNPFiltersDefined,
};
