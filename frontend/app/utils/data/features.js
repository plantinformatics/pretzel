import { intervalOrdered } from '../interval-calcs';

//------------------------------------------------------------------------------

const featureSymbol = Symbol.for('feature');

//------------------------------------------------------------------------------

function featuresIntervalsForTree(features) {
  const
  /** f.value.length may be 1.  intervals[*].length must be 2.
   * createIntervalTree() gets infinite recursion if intervals are not ordered.
   */
  intervals = features.map(f => {
    const i = f.value.length > 1 ? intervalOrdered(f.value) : [f.value[0], f.value[0]+1];
    i[featureSymbol] = f;
    return i;
  });
  return intervals;
}
//------------------------------------------------------------------------------

export {
  featuresIntervalsForTree,
};

//------------------------------------------------------------------------------
