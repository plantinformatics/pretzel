/* global exports */

/*----------------------------------------------------------------------------*/

/** binEvenLengthRound() is copied from backend/common/utilities/block-features.js
 * It can be factored into a source file shared between backend and frontend;
 * when that is easy to do (after updating framework versions).  Probably
 * include binBoundaries() in the factored file because it is closely related,
 * although frontend does not currently require that.
 *
 * Similarly utils/draw/interval-overlap.js is a copy of backend/common/utilities/interval-overlap.js
 */


/*----------------------------------------------------------------------------*/

/** Calculate the bin size for even-sized bins to span the given interval.
 * The bin size is rounded to be a multiple of a power of 10, only the first 1-2
 * digits are non-zero.
 * Used in @see binBoundaries().
 * @return lengthRounded
 */
function binEvenLengthRound(interval, nBins) {
  let lengthRounded;
  if (interval && (interval.length === 2) && (nBins > 0)) {
    /* if (interval[1] < interval[0])
     interval = interval.sort(); */
    /** handle -ve interval direction - could occur with only -ve features in block. */
    let intervalLength = Math.abs(interval[1] - interval[0]),
    binLength = intervalLength / nBins,
    digits = Math.floor(Math.log10(binLength)),
    eN1 = Math.exp(digits * Math.log(10)),
    mantissa = binLength / eN1,
    /** choose 1 2 or 5 as the first digit of the bin size. */
    m1 = mantissa > 5 ? 5 : (mantissa > 2 ? 2 : 1);
    if (digits >= 0) {
      lengthRounded = Math.round(m1 * eN1);
    } else {
      /** for e.g. digits===-1, eN1 is 0.09999999999999998,
       * and (m1 * eN1) is 0.4999999999999999 which will round down to 0.
       * So instead, use string operation to construct eN1, so .round() is not required.
       * This could probably be used for digits >= 0 also.
       *
       * A simpler form would be Math.round(m1 * eN1 * 100000) / 100000, but
       * that is limited to digits > -5, which would be sufficient for the
       * datasets used so far, e.g. a genetic map is ~200cM, so digits===-1, and
       * for a physical map digits==-6.
       */
      eN1 = '0.' + ('000000000000000'.substr(0, 1+digits)) + '1';
      lengthRounded = (m1 * eN1);
    }

    console.log('binEvenLengthRound', interval, nBins, intervalLength, binLength, digits, eN1, mantissa, m1, lengthRounded);
  }
  return lengthRounded;
};

/*----------------------------------------------------------------------------*/

export {
  binEvenLengthRound
};
