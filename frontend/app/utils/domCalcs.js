import { breakPoint } from './breakPoint';

/*----------------------------------------------------------------------------*/

/** @return x rounded to 2 decimal places
 */
function round_2(num)
{
  /* refn: answer/comments by ustasb, mrkschan, Alex_Nabu at
   * http://stackoverflow.com/users/1575238/
   * stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places
   * http://stackoverflow.com/questions/588004/is-javascripts-floating-point-math-broken
   */
  return Math.round((num + 0.00001) * 100) / 100;
}

/*----------------------------------------------------------------------------*/


/** Check if the given value is a number, i.e. !== undefined and ! isNaN().
 * @param l value to check
 * @param return the given parameter l, so that the call can be in a function chain.
 */
function checkIsNumber(l)
{
  if ((l === undefined) || Number.isNaN(l))
  {
    console.log("checkIsNumber", l);
    breakPoint();
  }
  return l;
}

/*----------------------------------------------------------------------------*/

/** approximate JavaScript floating point number precision.
 * Measured value in one test ~ 1e-16, so -15 seems safe.
 */
const precision = 1e-15;
/** @return true if the given numbers are equal to within the JavaScript
 * floating point number precision.
 */
function equalWithinPrecision(a, b) {
  let
  relativeDifference,
  equal = (a === b) || (Math.abs(relativeDifference = 2 * (a - b) / (a + b)) < precision);
  return equal;
}

//------------------------------------------------------------------------------

export { round_2, checkIsNumber, equalWithinPrecision };
