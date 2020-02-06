import { getAttrOrCP } from './ember-devel';


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


/** example element of array f : */
const featureCountDataExample = 
  {
    "_id": {
      "min": 100,
      "max": 160
    },
    "count": 109
  };

const featureCountDataProperties = {
  dataTypeName : 'featureCountData',
  datum2Location : function datum2Location(d) { return [d._id.min, d._id.max]; },
  datum2Value : function(d) { return d.count; },
  /** datum2Description() is not used;  possibly intended for the same
   * purpose as hoverTextFn(), so they could be assimilated.  */
  datum2Description : function(d) { return JSON.stringify(d._id); },
  hoverTextFn : function (d, block) {
    let valueText = '[' + d._id.min + ',' + d._id.max + '] : ' + d.count,
    blockName = block.view && block.view.longName();
    return valueText + '\n' + blockName;
  },
  valueIsArea : true
};

const dataConfigs = 
  [featureCountDataProperties, blockData, parsedData]
  .reduce((result, properties) => { result[properties.dataTypeName] = new DataConfig(properties); return result; }, [] );



/*----------------------------------------------------------------------------*/
/* Copied from draw-map.js */

import { stacks } from './stacks'; // just for oa.z and .y;  this will be replaced.
let blockFeatures = stacks.oa.z;

function featureLocation(blockId, d)
{
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





/*----------------------------------------------------------------------------*/



export { featureCountDataProperties, dataConfigs, DataConfig, blockDataConfig, blockData, parsedData, hoverTextFn, middle, scaleMaybeInterval, datum2LocationWithBlock };
