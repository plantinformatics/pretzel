import { breakPoint } from '../utils/breakPoint';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;


//------------------------------------------------------------------------------

function AxisChrName(oa) {
  const result = {
    mapChrName2Axis, 
    axisName2Chr, 
    axisName2MapChr, 
    makeMapChrName, 
    makeIntervalName, 
  };

  function axisChrName(chrID)
  {
    let cn=oa.
        cmName[chrID];
    // console.log(".axis text", chrID, cn);
    return cn.mapName + " " + cn.chrName;
  }

  function mapChrName2Axis(mapChrName)
  {
    const mapChr2Axis = oa.mapChr2Axis;
    let axisName = mapChr2Axis[mapChrName];
    return axisName;
  }
  /** @return chromosome name of axis id. */
  function axisName2Chr(axisName)
  {
    let c = oa.cmName[axisName];
    return c.chrName;
  }
  /** @return chromosome name of axis id, prefixed with mapName. */
  function axisName2MapChr(axisName)
  {
    let c = oa.cmName[axisName];
    return c && makeMapChrName(c.mapName, c.chrName);
  }

  return result;
}


function makeMapChrName(mapName, chrName)
{
  return mapName + ':' + chrName;
}
function makeIntervalName(chrName, interval)
{
  return chrName + "_" + interval[0] + "_" + interval[1];
}


//------------------------------------------------------------------------------


export {
  AxisChrName,
  makeMapChrName,
  makeIntervalName,
 };
