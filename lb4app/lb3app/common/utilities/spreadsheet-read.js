const { findLastIndex } = require('lodash/array');  // 'lodash.findlastindex'
const { pick } = require('lodash/object');


/* global exports */
/* global require */

//------------------------------------------------------------------------------

/* https://www.npmjs.com/package/xlsx
*/

var XLSX = require("xlsx");

// For Node ESM, the readFile helper is not enabled. Instead, fs.readFileSync should be used to read the file data as a Buffer for use with XLSX.read:

// import { readFileSync } from "fs";
// import { read } from "xlsx/xlsx.mjs";

//------------------------------------------------------------------------------

const trace = 1;

/** identity function, used in .map when no change is required.
 * and in .filter() to select truthy values, e.g. !== undefined.
 */
const I = (x) => x;

//------------------------------------------------------------------------------


/**
 * @param fileData
 * @return : {errors, warnings, datasets[]}
 * datasets[] may have .errors and .warnings
 */
function spreadsheetDataToJsObj(fileData) {
  const fnName = 'spreadsheetDataToJsObj';
  let status = {
    errors : [],
    warnings : [] };

  // readFile uses fs.readFileSync under the hood:
  // .readFile(fileName);
  const
  options = {type : 'binary'},
  workbook = XLSX.read(fileData, options);
  // const buf = readFileSync(fileName);
  /* buf is a Buffer */
  // const workbook = read(buf);

  const
  sheets = workbook.Sheets,
  metadata = sheets.Metadata && readMetadataSheet(sheets.Metadata),
  chromosomeRenaming = parseSheet(sheets, 'Chromosome Renaming', readChromosomeRenaming), 
  chromosomesToOmit = parseSheet(sheets, 'Chromosomes to Omit', readChromosomesToOmit);
  const
  nonDatasetSheets = ['User Guide', 'Metadata', 'Chromosome Renaming', 'Chromosomes to Omit'],
  datasets = 
    Object.entries(workbook.Sheets)
    .filter(([sheetName, sheet]) => ! nonDatasetSheets.includes(sheetName))

    .map(([sheetName, sheet]) => {
      /** dataset is defined in both cases; when ! typeAndName .warnings are returned in "dataset".
       * Otherwise filter undefined datasets with  .filter(I)
       */
      let dataset;
      const typeAndName = parseSheetName(sheetName);
      if (! typeAndName) {
        const warning = 'Sheet name "' + sheetName + '" does not identify a dataset type.';
        dataset = {warnings : [warning], sheetName};
      } else {
        const
        {sheetType, datasetName} = typeAndName,
        /** If user has entered space around | in the sheet name, and no space
         * in the metadata, then looking up metadata[] via (sheetType + '|' +
         * datasetName) will handle it.
         * (perhaps issue a warning in that case).
         */
        datasetMetadata = metadata && (
          metadata[sheetName] || metadata[sheetType + '|' + datasetName]);

        if (typeAndName.sheetType === 'Alias') {
          /** Aliases are not a dataset (maybe in future);
           * returning data in dataset.aliases[]
           */
          dataset = sheetToAliases(typeAndName.datasetName, sheet, datasetMetadata);
        } else {
        /** if parentName column, result may be array of datasets */
        dataset = sheetToDataset(
          sheetType, datasetName, sheet, datasetMetadata,
          chromosomeRenaming, chromosomesToOmit);
        }
      }
      return dataset;
    })
    .flat();

  console.log(fnName, fileData.length, workbook?.SheetNames, datasets);
  if (trace) {
    /** dataset may contain just a sheetName warning, instead of .blocks[].features[] */
    const
    block0 = datasets.map((d) => d.blocks?.[0] ?? d.aliases?.[0] ?? d.warnings),
    feature0 =  block0.map((b) => b?.features?.[0]);
    console.log(fnName, 'block0', block0, 'feature0', feature0);
  }

  /** for those datasets which are not OK and contain .warnings and/or .errors
   * drop the dataset and append the warnings / errors to status.{warnings,errors}
   */
  status.datasets = datasets
    .filter((dataset) => {
      const ok = /* ! dataset.sheetName || */  dataset.name;
      ['warnings', 'errors'].forEach((fieldName) => {
        if (! ok && dataset[fieldName]?.length) {
          status[fieldName] = status[fieldName].concat(dataset[fieldName]);
        }
      });
      return ok;
    });
  if (trace && (status.warnings?.length || status.errors?.length)) {
    console.log(fnName, status.errors.slice(0, 2), status.warnings.slice(0, 2));
  }

  return status;
}
exports.spreadsheetDataToJsObj = spreadsheetDataToJsObj;


//------------------------------------------------------------------------------
/** 
https://github.com/plantinformatics/pretzel/wiki/Upload#spreadsheet-format-and-templates

Dataset worksheets :

    Map|
    SNP|
    Alignment|
    QTL|
    Genome|


Example worksheet 'Metadata' :
Field 	Alignment|EST_SNP


'Chromosome Renaming'
From 	To

'Chromosomes to Omit'
Lcu.2RBY.unitig


    Map:
Marker 	Chromosome 	Position

    SNP:
Name 	Chromosome 	Position

    Alignment :
Name 	Chromosome 	Start 	End

    QTL :
Name 	parentName 	Chromosome 	Trait 	Start 	End 	Flanking Markers


    Genome :
Chromosome 	Start 	End

*/

//------------------------------------------------------------------------------

/** Use the sheet header row as names for the feature object fields
 * @param sheetType sheetType and datasetName are extracted from sheetName
 * @param datasetName from sheetName, with sheetType split off by parseSheetName().
 * @param sheet element of workbook.Sheets{}
 * @param metadata   for this sheet, aka datasetMetadata,
 * used for dataset.meta, apart from metadata.parent and .namespace which are moved to dataset.
 * @param chromosomeRenaming
 * @param chromosomesToOmit
 * @return array of datasets, which contain :
 * blocks : object {name : features },
 *  where features are JS object,
 */
function sheetToDataset(
  sheetType, datasetName, sheet, metadata,
  chromosomeRenaming, chromosomesToOmit) {

  /** meta includes /commonName|platform|shortName/ etc
   * partially based on sub setupMeta().
   */
  let parentName, namespace, meta;
  if (metadata) {
    ({parentName, namespace, ...meta} = metadata);
  } else {
    meta = {};
  }
  if (! namespace && meta.platform) {
    namespace = parentName ? parentName + ':' + meta.platform : meta.platform;
  }
  const metaType = (sheetType === 'Map') ? 'Genetic Map' : sheetType;
  meta.type ||= metaType;
  // -	$extraTags
  let tags = [];
  if (sheetType === 'QTL') {
    // QTL tag is required.
    tags.push(sheetType);
  }

  /*
      # If parentName is from Metadata worksheet instead of parentName column in
      # QTL worksheet, then there is just 1 dataset for this sheet, so can use
      # the worksheet name for datasetName.
      otherwise :
      if (feature.parentName) {
        datasetName = datasetName + ' - ' + parentName;
      }
  */

  let
  datasetTemplate = {
    type: 'linear',
    tags,
    meta};
  if (namespace) {
    datasetTemplate.namespace = namespace;
  }
  let
  /** Current dataset : blocks/features are added to this;  changes if .parentName changes. */
  dataset = Object.assign({name : datasetName}, datasetTemplate),
  datasets = [dataset];

  /** The spreadsheet value parentName corresponds to dataset.parent,
   * i.e. in metadata sheet : metadata.parentName, and in dataset worksheet column feature.parentName
   */
  /** based on sub makeTemplates() */
  if (parentName) {
    dataset.parent = parentName;
  }

  const
  { rowObjects, headerRow } = sheetToObj(sheet),
  features = rowObjects
  /** Skip blank lines */
  /** .Chromosome required (warning if values for other fields but no .Chromosome) */
    .filter((f) => f.Marker || f.Chromosome)
    .map((f) => { f.Chromosome = trimAndDeletePunctuation(ensureString(f.Chromosome)); return f; })
    .filter((f) => ! chromosomesToOmit || ! chromosomesToOmit.includes(f.Chromosome))  
    .map((f) => renameChromosome(f, chromosomeRenaming))

    .map(featureAttributes)
    .map(headerRow.includes('flankingMarkers') ? flankingMarkerValue : I)
    // .map(addValue0)
  ;

  /* drop the .__rowNum__ which is part of the result from sheet_to_json();
   * .__rowNum__ is a property, so Object.assign() is sufficient to leave it behind.
   * Quoting __rowNum__ in error messages / warnings to the user would be useful.
   */
  // .map((f) => Object.assign({}, f)

  /* group features into blocks by [].Chromosome

   * group by block or, if feature.parentName,  dataset+block with datasetName = sheetName + parentName
   * result is .blocks[] and .datasets[].blocks[], those become dataset (sheetname) .blocks and datasets (*) respectively
   */
  datasets = features.reduce(
    /* Uses imported variable dataset, which is the current dataset. */
    (datasets, feature) => {
      const chr = feature.Chromosome;
      let blocks;
      if (feature.parentName) {
        const datasetNameChild = datasetName + ' - ' + feature.parentName;
        /** if parentName is unchanged, continue adding to dataset,
         * else if dataset is empty, re-purpose it to datasetNameChild, otherwise create
         * a new dataset. */
        if (dataset.name === datasetNameChild) {
        } else if (! dataset.blocks || ! Object.keys(dataset.blocks).length) {
          dataset.name = datasetNameChild;
          dataset.parent = feature.parentName;
        } else if ((dataset = datasets.find((d) => (d.parentName == feature.parentName)))) {
          /* if feature.parentName matches a row earlier in this sheet, then append to that dataset. */
          // console.log('continuing to use', dataset);
        } else {
          dataset = Object.assign({name : datasetNameChild}, datasetTemplate);
          dataset.parent = feature.parentName;
          datasets.push(dataset);
        }
        delete feature.parentName;
      }
      /* {} enables blocks[chr].  convert later with blocksObjToArray() to []
       * with chr -> .name, .scope */
      blocks = (dataset.blocks ||= {});
      /** array of features */
      let block = (blocks[chr] ||= []);
      block.push(feature);
      return datasets;
    }, datasets);

  if (! features.length) {
    if (! dataset.warnings) {
      dataset.warnings = [];
    }
    dataset.warnings.push('Worksheet does not contain data rows');
  }

  datasets.forEach((dataset) => {
    if (dataset.blocks) {
      dataset.blocks = blocksObjToArray(dataset.blocks);
    }
  });

  return datasets;
};

/** Translate sheet data to an array of row objects, using the required header
 * row to name the object fields corresponding to columns.
 * Used for features : sheetToDataset and aliases : sheetToAliases().
 * @return { rowObjects, headerRow }
 * rowObjects : array of row objects
 * headerRow : array of column names parallel to sheet columns
 */
function sheetToObj(sheet) {
  /** if A1 starts with # then warn : 1st row must be headers
   * index of first row (A1-Z1) is 0
   */
  const
  // -	check for overlap of header names caused by header rename : first check for the target names
  /** map headerRow using header renaming */
  headerRow = sheet2RowArray(sheet, 0).map(normaliseHeader),
  rowIsComment = sheet2ColArray(sheet, 0)
    .map((ai) => (typeof ai === 'string') && ai.startsWith('#')),
  /** options.header        result    index
   *    'A'                 object    ['A1']
   *    '1'                 array     [integer]  integer >= 0
   *    [headerName, ...]   object    [headerName]
   */
  options = {header: headerRow},
  rowObjects = XLSX.utils.sheet_to_json(sheet, options)
  /** filter out comment rows */
    .filter((f, i) => ! rowIsComment[i])
  /** remove first (header) row */
    .filter((f, i) => i > 0)
  ;
  return {rowObjects, headerRow};
}


/** convert blocks {} to []
 */
function blocksObjToArray(blocks) {
  //  * . attribute names : .Chromosome -> block .name and .scope (latter with .* trimmed)
  const
  blocksArray = Object.entries(blocks)
    .map(([name, features]) => ({name, scope: name, features}));
  return blocksArray;
}

//------------------------------------------------------------------------------

/** Translate the sheet data into an array of aliases
 * @param datasetName not used, but could in future support ownership (user and
 * group) of a dataset of aliases.
 * @param metadata undefined, or with namespace1 and namespace2 (if different)
 * which can apply to all aliases in the sheet.
 * @return "dataset" object : { aliases[] }, for insertion into database.
 */
function sheetToAliases(datasetName, sheet, metadata) {
  const 
  {rowObjects, headerRow} = sheetToObj(sheet),
  /** column 'namespace' will be used as default for either namespace1 or namespace2.  */
  namespace1meta = ensureString(metadata?.namespace1 || metadata?.namespace),
  namespace2meta = ensureString(metadata?.namespace2 || namespace1meta),
  /** augment row.namespace{1,2} from metadata.
   * .namespace{1,2} are not required fields of Alias.
   */
  aliases = rowObjects.map((row) => {
    /* Sometimes Marker names are given as numbers, e.g. 16 for IWB16,
     * so string1, string2 can appear as numbers. ensureString() ensures they are strings.
     */
    /** field names from common/models/alias.json */
    ['string1', 'string2', 'namespace1', 'namespace2'].forEach((fieldName) => {
      if (row[fieldName] !== undefined) {
        row[fieldName] = ensureString(row[fieldName]);
      }
    });
    if (! row.namespace1 && namespace1meta) {
      row.namespace1 = namespace1meta;
    }
    if (! row.namespace2 && namespace2meta) {
      row.namespace2 = namespace2meta;
    }
    // There is no corresponding dataset; this is just for easy removal of test result.
    row.datasetId = datasetName;
    return row;
  }),
  /** may later create a dataset with {aliases, meta : metadata};
   * currently only .aliases is inserted.
   * Name is reported back in response, to GUI.
   */
  dataset = {name : datasetName, aliases, metadata};

  return dataset;
}

//------------------------------------------------------------------------------


/** Apply fn to sheets[sheetName] if it is not empty, and return the result.
 * @return false if sheet is undefined or empty
 */
function parseSheet(sheets, sheetName, fn) {
  const sheet = sheets[sheetName];
  let result = ! sheet || sheetIsEmpty(sheet) ? undefined : fn(sheet);
  return result;
}


/** Split e.g. 'Map| Dataset Name' to sheetType, datasetName.
 * @return {sheetType, datasetName} or undefined if sheetName does not match the
 * required format for dataset worksheets
 */
function parseSheetName(sheetName) {
  const
  match = sheetName.match(/^([A-Za-z]+) ?\| *(.+)/);
  let result;
  if (match) {
    const [all, sheetType, datasetName] = match;
    /* datasetName :
      # . trim spaces around , and |
      # . convert comma to space
      # If the dataset name field is empty, flag it with 'empty_datasetName'
      * from uploadSpreadsheet.bash : quotedHeadings()
    */
    result = {sheetType, datasetName};
  }
  return result;
}

/** Read the 'Metadata' sheet.
 */
function readMetadataSheet(sheet) {
  const
  data = sheet2Array(sheet),
  d1 = data.filter((d) => ! d[0]?.startsWith('#'))
    .map((d) => d.map(trimAndDeletePunctuation)),

  /*
    (4) [Array(2), Array(2), Array(2), Array(2)]
    0: (2) ['Field', 'Map| Template Map Dataset Name']
    1: (2) ['commonName', 'Template Common Name']
    2: (2) ['platform', 'Template_Platform_Name']
    3: (2) ['shortName', 'Template ShortName']
    length: 4
    [[Prototype]]: Array(0)
  */

  nameRow = d1.findIndex((d) => d[0] ==='Field'),
  // 0
  // metadataFields : skip any rows before 'Field' in column A - the start of the metadata table
  table = d1.slice(nameRow),

  // columnNames
  // dr = table[0],
  // (2) ['Field', 'Map| Template Map Dataset Name']

  /** uploadSpreadsheet.bash : readMetadata() accepts only these field names :
   * commonName|parentName|platform|shortName|namespace
   * Here instead : remove punctuation from fieldNames
   * (trimAndDeletePunctuation() is already applied above)
   */
  fieldNames = table.map((d) => normaliseFieldName(d[0])),
  // (4) ['Field', 'commonName', 'platform', 'shortName']

  datasetNames = table[0].slice(1),
  // ['Map| Template Map Dataset Name']

  // datasetsBase
  datasetsColumns = datasetNames.map((n,i) => ({n, c : table.map((d) => d[i+1])})),

  metadata = datasetsColumns.map((datasetColumn) => {
    const
    metadataEntries = datasetColumn.c.slice(1).map((v, i) => [fieldNames[i+1], v]),
    /*
      (3) [Array(2), Array(2), Array(2)]
      0: (2) ['commonName', 'Template Common Name']
      1: (2) ['platform', 'Template_Platform_Name']
      2: (2) ['shortName', 'Template ShortName']
    */

    /** There may be empty cells in the fieldNames column or in the dataset value column or both,
     * resulting in e.g. datasetMetadata {DOI: ..., undefined: undefined}
     * Undefined values are discarded by db insert, and probably undefined keys;
     * it is cleaner to filter them out here.
     */
    metadataEntriesDefined = metadataEntries
      .filter(([key, value]) => (key !== undefined) && (value !== undefined)),
    datasetMetadata = Object.fromEntries(metadataEntriesDefined);
    // {commonName: 'Template Common Name', platform: 'Template_Platform_Name', shortName: 'Template ShortName'}

    return datasetMetadata;
  }),
  datasetsEntries = datasetsColumns.map((datasetColumn, i) => [datasetColumn.n, metadata[i]]),
  /*
    [Array(2)]
    0: Array(2)
    0: "Map| Template Map Dataset Name"
    1: {commonName: 'Template Common Name', platform: 'Template_Platform_Name', shortName: 'Template ShortName'}
  */
  datasets = Object.fromEntries(datasetsEntries);
  /*
    {Map| Template Map Dataset Name: {…}}
    Map| Template Map Dataset Name:
    commonName: "Template Common Name"
    platform: "Template_Platform_Name"
    shortName: "Template ShortName"
  */
  
  return datasets;
}

/** Read the 'Chromosome Renaming' sheet.
 * @param sheet contains 2 columns [from, to], no header row.
 * @return [ [from, to], ... ]
*/
function readChromosomeRenaming(sheet) {
  let data = sheet2Array(sheet)
    .map((d) => d.map(trimAndDeletePunctuation));

  /** -	warning if data is not 1 column */
  return data;
}
/** Read the 'Chromosomes to Omit' sheet.
 * @param sheet contains 2 columns [from, to], no header row.
 * @return [ [from, to], ... ]
*/
function readChromosomesToOmit(sheet) {
  let data = sheet2Array(sheet)
    .map((d) => d.map(trimAndDeletePunctuation));
  /** -	warning if data is not 2 columns */
  return data;
}

/** if f.Chromosome is in chromosomeRenaming, rename it.
 * @param f mutate f.Chromosome
 * @param chromosomeRenaming undefined, or array of [from, to]
 */
function renameChromosome(f, chromosomeRenaming) {
  const rename = chromosomeRenaming?.find((cr) => f.Chromosome === cr[0]);
  if (rename) {
    f.Chromosome = rename[1];
  }
  return f;
}

//------------------------------------------------------------------------------

/**
 * These are applied by normaliseHeader() for headerRow, to recognise some
 * alternate names / abbreviations
 */
const headerRenaming = {

  // from uploadSpreadsheet.bash : columnFullName[]
  Name : 'name',
  // 'chr' : Chromosome
  // 'pos' : Position
  // 'end' : Position_End
  // 'Ref/Alt' : 'ref_alt'

  // from uploadSpreadsheet.bash : columnsKeyStringPrepare()
  Marker : 'name',
  Qs : 'pos',
  Qe : 'end',
  Start : 'pos',
  End : 'end',
  Position : 'pos',

  'Flanking Markers' : 'flankingMarkers',
  'Flanking_Markers' : 'flankingMarkers',

};

  /**
   * -	check for required headers 

  # column heading parentName
 
  # Check that the required columns are present
name chr pos
*/
/** Clean up a column header : remove outside whitespace, quotes and non-ascii characters,
 * and convert . to _.
 * Rename to a standard name those columns which allow multiple names, e.g. Position === pos === Start.
 * 
 * @param header text of column header; may be undefined
 */
function normaliseHeader(header) {
  if (header !== undefined) {
    header = normaliseFieldName(trimAndDeletePunctuation(header));
    const renamed = headerRenaming[header];
    if (renamed) {
      header = renamed;
    }
  }
  return header;
}
/** Column headers and metadata fields are used as names of fields in
 * feature.values and dataset.meta respectively.
 * This function removes punctuation from the given fieldName to ensure it is a
 * valid database field name.
 *
 * '.' is accepted in cell values, whereas header names become feature.values
 * field names, and '.' is not permitted in db field names as it is a field separator.
 * @param fieldName has already been processed by trimAndDeletePunctuation()
 */
function normaliseFieldName(fieldName) {
  if (fieldName !== undefined) {
  fieldName = fieldName
      .replace('.', '_');
  }
  return fieldName;
}

//------------------------------------------------------------------------------


/** Numeric cell values may present with an 18 digit mantissa instead of a few
 * digits, i.e. they need to be rounded.
 *
 * If the number has a few decimal digits in the source spreadsheet, then
 * the number of 0-s or 9-s to match here may be as few as 11. match a minimum of 6.
 * The SNP / marker name may also contain 4 0-s, but that is a different column and they are unlikely to have 8.
 *
 * e.g. 62.9 -> 62.900000000000006
 *
 * Currently applied to pos,end columns in featureAttributes(), but could be
 * applied to all columns, in cellValue().
 * @param pos if type is not number then returned unchanged.
 */
function roundNumber(pos) {
  /** based on snps2Dataset.pl : roundPosition()   */
  if (typeof pos === 'number') {
    const
    posText = '' + pos;
    if (posText.match(/000000|999999/)) {
      // from perl : pos = (sprintf('%.8f', pos) =~ s/0+$//r =~ s/\.$//r);
      const
      roundedText = pos.toFixed(8),
      rounded = roundedText
        .replace(/0+$/, '')
        .replace(/\.$/, '');
      pos = +rounded;
    }
  }
  return pos;
}
/** If cell value is not a string, e.g. a number, convert it to string.
 */
function ensureString(s) {
  return (typeof s === 'string') ? s : '' + s;
}

const deletePunctuationRe = /[^-_.,\/\n |0-9A-Za-z]+/g;
/**
 * Sanitize input by removing punctuation other than space, comma, -, _, ., /, \n
 * Commonly _ and . are present in parentName.
 * Apply to Metadata, and to .Chromosome and chromosomes{Renaming,ToOmit}
 * Added : allow '|' used in worksheet name e.g. 'Map| myMap',
 * and in chromosome names generated by genbank,
 * e.g. chromosomeRenaming : 'gi|442654316|gb|CM001764.1|' -> 'Ca1'
 *  (examples in genbank_chr_rename.sed)
 */
function deletePunctuation(s) {
  /* based on deletePunctuation() in both snps2Dataset.pl and uploadSpreadsheet.bash
   * related : chromosomeRenamePrepare(), chrOmitPrepare().
   */
  return s.replaceAll(deletePunctuationRe, '');
}
function trimAndDeletePunctuation(s) {
  return (s == undefined) ? s : deletePunctuation(trimOutsideQuotesAndSpaces(s));
}

/*

encode_json_2() : looks_like_number() apply to fields other than 'Flanking Markers'


sub blockHeader($)
meta" : { "chromosomeRenamedFrom
"name": "blockName",
            "scope": "blockScope",$blockMeta

----------------------------------------
not implemented :

snps2Dataset.pl : sub headerLine() :
/^label	chr	pos/
/^name,chr,pos/
/Marker|Name/
/Chromosome/
/Contig,Position/
Require first row to be header row.

  # For QTL : Flanking Marker by itself in a row is added to .values { "flankingMarkers" : [] }
  # of the current feature (QTL)

    # If trait is blank / empty, use current.

    $a[c_chr] =~ s/^chr//;

# Illumina OPA SNP names are [1234]000 or SNP_[1234]000.
# Prefix with SNP_ if not present, to make all consistent.
sub markerPrefix($) {

($start eq "n/a")

      createDataset();
      appendToBlock();  // -b blockId is used when running snps2Dataset.pl directly from command line

----------------------------------------

%chromosomeRenames :
    # Apply to Scope column, or Chromosome.


sub snpLine($)

maybe
  # If name is blank, use S_No, or line number.
  my $c_serial_number = $columnsKeyLookup{'S_No'};
    $a[c_name] = $serial_number;


# Recognise decimal fraction aliasing and round the number. 
sub roundPosition($)
if needed


*/

/*
-	

Map|
function linkageMap()

Alignment|
function snpList()

    if [ -n "$parentName" ]
    then
      datasetNameFull="$parentName.$datasetName"
      nameArgs=(-d "$datasetNameFull" -p $parentName -n"$parentName:$platform")
    else
      datasetNameFull="$datasetName"
      nameArgs=(-d "$datasetName" )
      if [ -n "$platform" ]
      then
        nameArgs+=(-n "$platform")
      fi
    fi
optional nameArgs :
$shortName
$commonName

this was just for grouping ? : sort -t, -k $columnNum_chr

QTL|
function qtlList()
require headers match : /Trait|Ontology/

type,QTL

all Flanking Markers in a single row/cell

    # Sort by parentName (if defined) then chr column
or group by parent


-d "$datasetName"  -n "$namespace" -c "$commonName"
-t QTL


from snps2Dataset.pl :

$extraTags = $options{t}; # '"SNP"';  #  . ", \"HighDensity\"";	





 */

//------------------------------------------------------------------------------

function trimOutsideSpaces(s) {
/*
 * from uploadSpreadsheet.bash : trimOutsideSpaces_sed
 # Trim spaces outside "" in headings, e.g. : "Sr_No ",Name,...
 */
  return s.trim();
}
const
/** match white-space (space, \t\n\v\r), quotes (single, double, back) or non-ascii */
spaceNonAscii = '([\\s"\']|[^\x00-\x7F])+',
spaceNonAsciiStart = new RegExp('^' + spaceNonAscii),
spaceNonAsciiEnd = new RegExp(spaceNonAscii + '$');

/** Remove sequences of spaces, quote-like and non-ascii
 * characters from each end of the string.
 */
function trimOutsideQuotesAndSpaces(s) {
  s = s
    .replace(spaceNonAsciiStart, '')
    .replace(spaceNonAsciiEnd, '');
  /* could match matching quotes, e.g.
   * .replace(/^"(\S+)"$/, '$1')
   * but single-quotes are sometimes paired with the (non-Ascii) backquote : '...’
    */

/* from :
sub trimOutsideQuotesAndSpaces($) {
    # Unicode chars such as 0xa0 (&nbsp) and 0x82 have been found in received spreadsheets.
...
    # The approach taken is to remove non-ascii chars on the outside of values,

function qtlList()
    # Remove non-ascii and quotes around alphanumeric, to handle chr with &nbsp wrapped in quotes, 
*/
  return s;
}

//------------------------------------------------------------------------------

/** @return true if cellValue is not undefined and not null.
 * @desc
 * note : sheet2Row() returns undefined for empty cells, not null.
 */
function valueIsDefined(cellValue) {
  return cellValue !== undefined;
}
/** Remove trailing undefined values from the array, which is a row of cell values,
 * e.g. headerRow.
 */
function trimRightUndefined(row) {
  const
  lastDefined = findLastIndex(row, valueIsDefined),
  trimmed = row.slice(0, lastDefined + 1);
  return trimmed;
}

//------------------------------------------------------------------------------

/**
 * Given a string (e.g. flanking marker cell value),
 * split at comma or space/s,
 * @return array of words (marker name) - strings
 */
function splitToStringArray(s) {
  /* based on sub splitAndQuote() */
  return s.split(/,|\s+/);
}


/** if feature.values.flankingMarkers is a number, convert to a string in an array.
 * if it is a string, split into an array of strings.
 * @param feature
 * @return feature, with possibly modified .flankingMarkers
 */
function flankingMarkerValue(feature) {
  let fm = feature.values.flankingMarkers;
  if (fm) {
    let flankingMarkers;
    if (typeof fm === 'number') {
      flankingMarkers = ['' + fm];
    } else if (typeof fm === 'string') {
      flankingMarkers = splitToStringArray(fm);
    }
    if (flankingMarkers) {
      feature.values ||= {};
      feature.values.flankingMarkers = flankingMarkers;
      delete feature.flankingMarkers;
    }
  }
  return feature;
}
/** -	filter out features without required fields; report warnings and errors, for display in GUI.
 */
function requiredFields(feature, sheetType) {
/*
  # for QTL : allow blank Start/End fields, if flanking marker field is defined
  if (($#value == -1) && ! $hasFlankingMarkers)
    {
      print STDERR "In Dataset $datasetName, Feature $name has no Start/End, and no Flanking Markers\n";
    }
*/
}

/** Adjust attribute names of feature :
 * .pos (Position) (maybe ._start) -> value, value_0
 */
function featureAttributes(feature) {
  let
  /** feature.Chromosome is a relationship with the parent block, and will be
   * moved to the block in sheetToDataset() : blocks = features.reduce() and
   * Object.entries(blocks) .map ... to { name, scope }
   * it could be dropped here instead ?
   *
   * Column names not matching the core values (pos, end, Chromosome, name, parentName)
   * are placed in feature.values{}
   */
  {pos, end, Chromosome, name, parentName, ...values} = feature,
  value = [];
  if (pos !== undefined) {
    pos = roundNumber(pos);
    value.push(pos);
  }
  if (end !== undefined) {
    end = roundNumber(end);
    value.push(end);
  }
  let featureOut = pick(feature, ['value', 'Chromosome', 'name', 'parentName']);
  /* .value may be [], e.g.  paths-progressive.js : pushFeature() expects
   * feature.value to be defined and to be an array.
   */
  featureOut.value = value;

  const valuesKeys = Object.keys(values);
  if (valuesKeys.length) {
    /** apply roundNumber() to numeric cell values.
     *
     * This could be done in cellValue(), but it is preferable to avoid the name
     * and flankingMarkers columns : marker names may given as numbers, and some
     * are e.g. 20000645 - as platform sizes increase that could match the
     * /000000/ pattern in roundNumber().
     */
    valuesKeys.forEach((key) => {
      /** delete values in commented-out columns */
      if (key.startsWith('#')) {
        delete values[key];
      } else if (key !== 'flankingMarkers') {
        values[key] = roundNumber(values[key]);
      }
    });
    featureOut.values = values;
  }

  /** Add .value_0 to feature */
  /** based on sub printFeature() */
  const start = pos;
  featureOut.value_0 = (start ?? 'null') || ((start !== '') ? start : 'null');

  return featureOut;
}

/** Add .value_0 to feature
 * This is currently done by featureAttributes() - may split it out.
 */
function addValue0(feature) {

  return feature;
}


//------------------------------------------------------------------------------

/** generic functions based on SheetJS functions */

function sheetIsEmpty(sheet) {
  return sheet['!ref'] === 'A1:A1';
}

/**
 * @return array of (row) arrays
 * @desc
 * sheet2Array(), sheet2RowArray(), sheet2Row() are based on :
 * sheet2arr() by reviewher  https://github.com/SheetJS/sheetjs/issues/270#issuecomment-283992162
 */
function sheet2Array(sheet) {
  let result = [];
  /** empty sheet has no sheet['!ref'] */
  const sheetRef = sheet['!ref'];
  if (sheetRef) {
    const range = XLSX.utils.decode_range(sheetRef);
    for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
      const row = sheet2Row(sheet, range, rowNum);
      result.push(row);
    }
  }
  return result;
};
/**
 * @param sheet
 * @param rowNum  integer >= 0
 * @return row : array of cell values
*/
function sheet2RowArray(sheet, rowNum) {
  let row;
  const sheetRef = sheet['!ref'];
  if (sheetRef) {
    const range = XLSX.utils.decode_range(sheetRef);
    if ((rowNum >= range.s.r) && (rowNum <= range.e.r)) {
      row = sheet2Row(sheet, range, rowNum);
    }
  }
  return row;
};

/** Return an array of cell values in the row rowNum between range start and end columns.
 * Apply trimRightUndefined() to the result, removing trailing undefined values.
 * Used by sheet2Array(), sheet2RowArray().
 * @param sheet
 * @param range decoded range of the sheet
 * @param rowNum  integer >= 0
 * @return row
 */
function sheet2Row(sheet, range, rowNum) {
  let row = [];
  for (let colNum = range.s.c; colNum <= range.e.c; colNum++) {
    const
    value = cellValue(sheet, rowNum, colNum);
    row.push(value);
  }
  row = trimRightUndefined(row);
  return row;
}

/**
 * @param sheet
 * @param rowNum  integer >= 0
 * @param colNum  integer >= 0
 * rowNum and colNum are within range of sheet.
 */
function cellValue(sheet, rowNum, colNum) {
  const
  cellAddress = XLSX.utils.encode_cell({r: rowNum, c: colNum}),
  cell = sheet[cellAddress],
  value = (typeof cell === 'undefined') ? void 0 : cell.w;
  return value;
}

/**
 * @param sheet
 * @param colNum  integer >= 0
 */
function sheet2ColArray(sheet, colNum) {
  var range = XLSX.utils.decode_range(sheet['!ref']);
  let col = [];
  for (let rowNum = range.s.r; rowNum <= range.e.r; rowNum++) {
    const
    value = cellValue(sheet, rowNum, colNum);
    col.push(value);
  }
  return col;
}

//------------------------------------------------------------------------------
