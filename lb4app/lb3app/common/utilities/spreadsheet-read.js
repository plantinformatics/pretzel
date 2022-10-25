const { findLastIndex } = require('lodash/array');  // 'lodash.findlastindex'

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

/** identity function, used in .map when no change is required.
 * and in .filter() to select truthy values, e.g. !== undefined.
 */
const I = (x) => x;

//------------------------------------------------------------------------------


/**
 * @param fileData
 */
function spreadsheetDataToJsObj(fileData) {
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
      let dataset;
      const typeAndName = parseSheetName(sheetName);
      if (! typeAndName) {
        /** -	warning : sheetName */
      } else {
        const
        {sheetType, datasetName} = typeAndName,
        datasetMetadata = metadata && metadata[sheetName];
        /** if parentName column, result may be array of datasets */
        dataset = sheetToDataset(
          sheetType, datasetName, sheet, datasetMetadata,
          chromosomeRenaming, chromosomesToOmit);
      }
      return dataset;
    })
    /** this handles ! typeAndName; in next commit will probably return .warnings in "dataset" */
    .filter(I)
    .flat();

  console.log(fileData.length, workbook?.SheetNames, datasets);
  return datasets;
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
  const metaType = (sheetType === 'Map') ? 'Genetic Map' : sheetType;
  meta.type ||= metaType;

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
    tags: [
      // -	$extraTags
    ],
    meta},
  dataset = Object.assign({name : datasetName}, datasetTemplate),
  datasets = [dataset];

  /** based on sub makeTemplates() */
  if (parentName) {
    dataset.parentName = parentName;
  }
  if (namespace) {
    dataset.namespace = namespace;
  }

  /** if A1 starts with # then warn : 1st row must be headers
   * index of first row (A1-Z1) is 0
   */
  const
  // -	check for overlap of header names caused by header rename : first check for the target names
  /** map headerRow using header renaming */
  headerRow = trimRightUndefined(sheet2RowArray(sheet, 0)).map(normaliseHeader),
  rowIsComment = sheet2ColArray(sheet, 0)
    .map((ai) => (typeof ai === 'string') && ai.startsWith('#')),
  /** options.header        result    index
   *    'A'                 object    ['A1']
   *    '1'                 array     [integer]  integer >= 0
   *    [headerName, ...]   object    [headerName]
   */
  options = {header: headerRow},
  features = XLSX.utils.sheet_to_json(sheet, options)
  /** filter out comment rows */
    .filter((f, i) => ! rowIsComment[i])
  /** remove first (header) row */
    .filter((f, i) => i > 0)
  /** -	commented-out columns */
  /** -	column renames */
  /** Skip blank lines */
  /** .Chromosome required (warning if values for other fields but no .Chromosome) */
    .filter((f) => f.Marker || f.Chromosome)
    .map((f) => { f.Chromosome = trimAndDeletePunctuation(f.Chromosome); return f; })
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
        const datasetNameChild = datasetName + ' - ' + parentName;
        /** if parentName is unchanged, continue adding to dataset,
         * else if dataset is empty, re-purpose it to datasetNameChild, otherwise create
         * a new dataset. */
        if (dataset.name === datasetNameChild) {
        } else if (! dataset.blocks || ! Object.keys(dataset.blocks).length) {
          dataset.name = datasetNameChild;
        } else {
          dataset = Object.assign({name : datasetNameChild}, datasetTemplate);
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

  return dataset;
};

/** convert blocks {} to []
 */
function blocksObjToArray(blocks) {
  //  * . attribute names : .Chromosome -> block .name and .scope (latter with .* trimmed)
  const
  blocksArray = Object.entries(blocks)
    .map(([name, features]) => ({name, scope: name, features}));
  return blocksArray;
}


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
  d1 = data.filter((d) => !d[0].startsWith('#'))
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

  i = d1.findIndex((d) => d[0] ==='Field'),
  // 0
  // metadataFields : skip any rows before 'Field' in column A - the start of the metadata table
  d2 = d1.slice(i),

  // columnNames
  // dr = d2[0],
  // (2) ['Field', 'Map| Template Map Dataset Name']

  /** uploadSpreadsheet.bash : readMetadata() accepts only these field names :
   * commonName|parentName|platform|shortName|namespace
   * Instead :  -	remove punctuation from fieldNames
   */
  fieldNames = d2.map((d) => d[0]),
  // (4) ['Field', 'commonName', 'platform', 'shortName']

  datasetNames = d2[0].slice(1),
  // ['Map| Template Map Dataset Name']

  // datasetsBase
  d3 = datasetNames.map((n,i) => ({n, c : d2.map((d) => d[i+1])})),

  metadata = d3.map((d3i) => {
    const
    metadataEntries = d3i.c.slice(1).map((v, i) => [fieldNames[i+1], v]),
    /*
      (3) [Array(2), Array(2), Array(2)]
      0: (2) ['commonName', 'Template Common Name']
      1: (2) ['platform', 'Template_Platform_Name']
      2: (2) ['shortName', 'Template ShortName']
    */

    datasetMetadata = Object.fromEntries(metadataEntries);
    // {commonName: 'Template Common Name', platform: 'Template_Platform_Name', shortName: 'Template ShortName'}

    return datasetMetadata;
  }),
  datasetsEntries = d3.map((d3i, i) => [d3i.n, metadata[i]]),
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
/**
 * @param header text of column header; may be undefined
 */
function normaliseHeader(header) {
  if (header !== undefined) {
    header = trimOutsideQuotesAndSpaces(header);
    const renamed = headerRenaming[header];
    if (renamed) {
      header = renamed;
    }
  }
  return header;
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
/** match white-space (space or \t 	) or non-ascii */
spaceNonAscii = '(\\s|[^\x00-\x7F])+',
spaceNonAsciiStart = new RegExp('^' + spaceNonAscii),
spaceNonAsciiEnd = new RegExp(spaceNonAscii + '$');

function trimOutsideQuotesAndSpaces(s) {
  s = s
    .replace(spaceNonAsciiStart, '')
    .replace(spaceNonAsciiEnd, '')
    .replace(/^"(\S+)"$/, '$1');

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
function trimRightUndefined(headerRow) {
  const
  lastDefined = findLastIndex(headerRow, valueIsDefined),
  trimmed = headerRow.slice(0, lastDefined + 1);
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
    value.push(pos);
  }
  if (end !== undefined) {
    value.push(end);
  }
  let featureOut = {};
  featureOut.value = value;
  ['Chromosome', 'name', 'parentName'].forEach((fieldName) => {
    if (feature[fieldName] !== undefined) {
      featureOut[fieldName] = feature[fieldName];
    }
  });

  if (Object.keys(values).length) {
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
  var result = [];
  var row;
  var rowNum;
  var range = XLSX.utils.decode_range(sheet['!ref']);
  for(rowNum = range.s.r; rowNum <= range.e.r; rowNum++){
    row = sheet2Row(sheet, range, rowNum);
    result.push(row);
  }
  return result;
};
/**
 * @param sheet
 * @param rowNum  integer >= 0
 * @return row : array of cell values
*/
function sheet2RowArray(sheet, rowNum) {
  var row;
  var range = XLSX.utils.decode_range(sheet['!ref']);
  if ((rowNum >= range.s.r) && (rowNum <= range.e.r)) {
    row = sheet2Row(sheet, range, rowNum);
  }
  return row;
};

/** 
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
