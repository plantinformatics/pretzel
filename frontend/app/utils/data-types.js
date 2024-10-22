import { getAttrOrCP } from './ember-devel';


/*----------------------------------------------------------------------------*/
/** Feature values

The API relies on Features having a .value which is a location or an interval,
represented as [location] or [from, to].
The plan is to support other values; using JSON in the database and API enables 
variant value types to be added in a way which is opaque to the API.
For example, the effects probability data has been added as [location, undefined, [probabilities, ... ]].
The API relies on .value[0] and optionally .value[1], and ignores other elements of .values[].
We might choose a different format as we include more data types in the scope,
e.g. we could split non-location values out to a separate field,
so it is desirable to access feature values through an access layer which abstracts away from the storage structure used.
The DataConfig class defined here provides such an abstraction.
It was added to support the axis-charts, but can be progressively used in other modules.
This can be integrated into models/feature.js

 */

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/** Enable appended display of blockIds in hoverTextFn.  */
const options_devel = false;

/*----------------------------------------------------------------------------*/

class DataConfig {
  /*
   dataTypeName;
   datum2Location;
   datum2Value;
   datum2Description;
   */
  constructor (properties) {
    if (properties)
      Object.assign(this, properties);
  }
};

/*----------------------------------------------------------------------------*/


/** @param name is a feature or gene name */
function name2Location(name, blockId)
{
  /** @param ak1 axis name, (exists in axisIDs[])
   * @param d1 feature name, i.e. ak1:d1
   */
  return featureLocation(blockId, name);
}

/** Used for both blockData and parsedData. */
function datum2LocationWithBlock(d, blockId) { return name2Location(d.name, blockId); }
function datum2Value(d) { return d.value; }
let parsedData = {
  dataTypeName : 'parsedData',
  // datum2LocationWithBlock assigned later,
  datum2Value : datum2Value,
  datum2Description : function(d) { return d.description; }
},
blockData = {
  dataTypeName : 'blockData',
  // datum2LocationWithBlock assigned later,
  /** The effects data is placed in .value[2] (the interval is in value[0..1]).
   * Use the first effects value by default, but later will combine other values.
   */
  datum2Value : function(d) { let v = d.value[2]; if (v.length) v = v[0]; return v; },
  datum2Description : function(d) { return JSON.stringify(d.value); }
};

/** Determine the appropriate DataConfig for the given data.
 */
function blockDataConfig(chart) {
  let
    isBlockData = chart.length && (chart[0].description === undefined);

  let dataConfigProperties = isBlockData ? blockData : parsedData;
  return dataConfigProperties;
}


/*----------------------------------------------------------------------------*/

/** Inspect fcs to determine if it is a result of a useBucketAuto===true request..
 * frontend passes useBucketAuto===undefined, but if no interval then useBucketAuto===true (blockFeaturesCounts() - backend/common/utilities/block-features.js)
 */
function fcsProperties(fcs) {
  let
  isAuto = fcs?.result?.length && ! fcs?.result[0]?.idWidth,
  properties = isAuto ? featureCountAutoDataProperties : featureCountDataProperties;
  return properties;
}



/** example element of array f :
 * result of $bucketAuto - it defines _id.{min,max}
 */
const featureCountAutoDataExample = 
  {
    "_id": {
      "min": 100,
      "max": 160
    },
    "count": 109
  };

const featureCountAutoDataProperties = {
  dataTypeName : 'featureCountAutoData',
  datum2Location : function datum2Location(d) { return [d._id.min, d._id.max]; },
  datum2Value : function(d) { return d.count; },
  /** datum2Description() is not used;  possibly intended for the same
   * purpose as hoverTextFn(), so they could be assimilated.  */
  datum2Description : function(d) { return JSON.stringify(d._id); },
  hoverTextFn : function (event, block) {
    const d = event.target.__data__;
    let valueText = '[' + d._id.min + ',' + d._id.max + '] : ' + d.count,
    blockName = blockHoverName(block);
    if (options_devel) {
      blockName += '\n' + (block.view && block.view.longName());
    }
    return valueText + '\n' + blockName;
  },
  valueIsArea : true
};

/** example of result of $bucket - it defines _id as a single value (the lower boundary of the bin).
*/
const featureCountDataExample = 
  {_id: 77, count: 3};

const featureCountDataProperties = Object.assign(
  {}, featureCountAutoDataProperties, {
    dataTypeName : 'featureCountData',
    datum2Location : function datum2Location(d) { return [d._id, d._id + d.idWidth[0]]; },
    hoverTextFn : function (event, block) {
      const d = event.target.__data__;
      let valueText = '' + d._id + ' +' + d.idWidth[0] + ' : ' + d.count,
      blockName = blockHoverName(block);
      if (options_devel) {
        blockName += '\n' + (block.view && block.view.longName());
      }
      return valueText + '\n' + blockName;
    }
  }
);
/** $bucket returns _id equal to the lower bound of the bin / bucket, and does
 * not return the upper bound, since the caller provides the list of boundaries
 * (see backend/common/utilities/block-features.js : boundaries()).
 * The result is sparse - if a bin count is 0 then the bin is omitted from the
 * result.  So blockFeaturesCounts() adds idWidth : lengthRounded to each bin in
 * the result; this value is constant for all bins, because boundaries()
 * generates constant-sized bins.
 * That is used above in featureCountDataProperties : datum2Location() : it
 * generates the upper bound by adding idWidth to the lower bound.
 * The form of idWidth is an array with a single value, because it is added
 * using an output accumulator in the $bucket : groupBy.
 */


const dataConfigs = 
  [featureCountAutoDataProperties, featureCountDataProperties, blockData, parsedData]
  .reduce((result, properties) => { result[properties.dataTypeName] = new DataConfig(properties); return result; }, {} );



/*----------------------------------------------------------------------------*/
/* Copied from draw-map.js */

import { stacks } from './stacks'; // just for oa.z and .y;  this will be replaced.
function get_blockFeatures() { return stacks.oa && stacks.oa.z; }


function featureLocation(blockId, d)
{
  let blockFeatures = get_blockFeatures();
  let feature = blockFeatures[blockId][d];
  if (feature === undefined)
  {
    console.log("axis-chart featureY_", blockId, blockFeatures[blockId], "does not contain feature", d);
  }
  let location = feature && feature.location;
  return location;
}

/** If the given value is an interval, convert it to a single value by calculating the middle of the interval.
 * @param location is a single value or an array [from, to]
 * @return the middle of an interval
 */
function middle(location) {
  let result = location.length ?
    location.reduce((sum, val) => sum + val, 0) / location.length
    : location;
  return result;
}

/** @return a function to map a chart datum to a y value or interval.
 */
function scaleMaybeInterval(datum2Location, yScale) {
  /* In both uses in this file, the result is passed to middle(), so an argument
   * could be added to scaleMaybeInterval() to indicate the result should be a
   * single value (using mid-point if datum location is an interval).
   */

  function datum2LocationScaled(d) {
    /** location may be an interval [from, to] or a single value. */
    let l = datum2Location(d);
    return l.length ? l.map((li) => yScale(li)) : yScale(l); };
  return datum2LocationScaled;
}

/*----------------------------------------------------------------------------*/
/* based on axis-1d.js: hoverTextFn() and setupHover() */

/** eg: "ChrA_283:A:283" */
function hoverTextFn (feature, block) {
  let
    value = getAttrOrCP(feature, 'value'),
  /** undefined values are filtered out below. */
  valueText = value && (value.length ? ('' + value[0] + ' - ' + value[1]) : value),

  /** block.view is the Stacks Block. */
  blockName = block.view && block.view.longName(),
  featureName = getAttrOrCP(feature, 'name'),
  /** common with dataConfig.datum2Description  */
  description = value && JSON.stringify(value),

  text = [featureName, valueText, description, blockName]
    .filter(function (x) { return x; })
    .join(" : ");
  return text;
};

/** Provided name text to identify the block, for use in chart/track hover dialogs.
 * In featureCount{,Auto}DataProperties @see hoverTextFn
 */
function blockHoverName(block) {
  /** This could be moved to models/block.js as a CP, although the text format is
   * intended to be specific to the needs of a small hover dialog.
   */
  let text = 
      block.get('datasetNameAndScope') + '\n' +
      (block.get('referenceDatasetName') || block.get('namespace'));
  return text;
}

/*----------------------------------------------------------------------------*/



export { featureCountAutoDataProperties, featureCountDataProperties, fcsProperties, dataConfigs, DataConfig, blockDataConfig, blockData, parsedData, hoverTextFn, middle, scaleMaybeInterval, datum2LocationWithBlock };
