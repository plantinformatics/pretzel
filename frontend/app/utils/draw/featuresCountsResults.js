import { isEqual } from 'lodash/lang';

import {
  intervalOverlap,
  intervalJoin,
} from '../interval-calcs';
import { inInterval } from './interval-overlap';
import { inRange, subInterval } from './zoomPanCalcs';

const dLog = console.debug;


function featuresCountsResultsCheckOverlap(fcr1, fcr2) {
  let o = intervalOverlap([fcr1.domain, fcr2.domain]),
      fcr1O = featuresCountsResultsFilter(fcr1, o),
      fcr2O = featuresCountsResultsFilter(fcr2, o),
      same = isEqual(fcr1O, fcr2O);
  if (! same) {
    dLog('featuresCountsResultsCheckOverlap', same, fcr1, fcr2, o, fcr1O, fcr2O);
  }
  return same;
}

/** The two given featuresCountsResults overlap; merge them.
 * If one contains the other, then discard the sub-interval,
 * otherwise ap/pre -pend to fcr1 the part of fcr2 which is outside of fcr1.
 * @return the larger or combined featuresCountsResult
 */
function featuresCountsResultsMerge(fcr1, fcr2) {
  let fcr;
  if (subInterval(fcr1.domain, fcr2.domain)) {
    fcr = fcr2;
  } else if (subInterval(fcr2.domain, fcr1.domain)) {
    fcr = fcr1;
  } else {
    let
    addInterval = intervalJoin('subtract', fcr2.domain, fcr1.domain),
    add = featuresCountsResultsFilter(fcr2, addInterval);
    fcr = fcr1;
    fcr.result = fcr.result.concat(add.result);
    // this doesn't count the empty bins in fcr2 / add
    fcr.nBins += add.result.length;
    fcr.domain = intervalJoin('union', fcr1.domain, fcr2.domain);
  }
  dLog('featuresCountsResultsMerge', fcr, fcr1, fcr2);
  return fcr;
}

/** Copy a featuresCountsResult, within the given domain.
 * @return a copy of fcResult, with results outside of domain filtered out.
 */
function featuresCountsResultsFilter(fcResult, domain) {
  let {...out} = fcResult;
  /* could use datum2Location()[0], because in the case of
   * featureCountAutoDataProperties it will be _id.min
   */
  out.result = out.result.filter((fc) => inRange(fc._id, domain));
  out.nBins = out.result.length;
  out.domain = domain;
  dLog('featuresCountsResultsFilter', out, fcResult, domain);
  return out;
}

/** Truncate excess decimal places in fcResult.result[*]._id
 * If result[].idWidth < 1 then ._id often has alias error
 * e.g. {_id: 49.20000000000024, count: 1, idWidth: [0.2]}
 *
 * This impacts on comparison isEqual() done by
 * featuresCountsResultsCheckOverlap(), which is purely for
 * development verification, and otherwise doesn't matter.
 *
 * @param fcResult  fcResult.result[*]._id is mutated in situ.
 */
function featuresCountsResultsTidy(fcResult) {
  let result = fcResult.result;
  if (result[result.length-1] === undefined) {
    result.pop();
  }

  result.forEach((r) => {
    // this assumes featureCountDataProperties, not featureCountAutoDataProperties.
    if (r.idWidth < 1) { r._id = Math.round(r._id  / r.idWidth) * r.idWidth; }
  });
}

export {
  featuresCountsResultsCheckOverlap,
  featuresCountsResultsMerge,
  featuresCountsResultsFilter,
  featuresCountsResultsTidy,
};
