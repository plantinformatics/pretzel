'use strict';

/* global exports */

/*----------------------------------------------------------------------------*/

const sliceContextLength = 300;

/** Construct an error context string.
 * To provide context for an error reported at a character position in the given
 * text bufferData, show a slice of text surrounding the error, with a line " ^"
 * following the error line and pointing to the error position.
 *
 * Used in uploadParsedTryCb(), and possibly handleJson(), to show the context
 * of a parse error reported by JSON.parse().
 *
 * @param bufferData  Buffer(), containing text
 * @param position  character position in bufferData to point to.  (integer not string)
 */
exports.bufferSlice = function(bufferData, position) {
  const
  /** [start,end] of slice */
  slice = [
    Math.max(position - sliceContextLength/2, 0),
    Math.min(position + sliceContextLength/2, bufferData.length)], // position is integer, not a string
    sliceLength = slice[1] - slice[0],
  sliceName = bufferData.asciiSlice ? 'asciiSlice' : 'slice',
  e0 = bufferData[sliceName](slice[0], position),
  e0m = e0.match(/(.*\n)(.*)/ms),
  e1 = bufferData[sliceName](position, slice[1]),
  e1m = /^([^\n]+)(.*)/ms .exec(e1);

  let result = [
    e0m[1], // ends with \n
    e0m[2] + e1m[1] + "\n",  // e0m[2] + e1m[1] does not contain \n
    ' '.repeat(sliceContextLength/2 - e0m[1].length) + "^",
    e1m[2]  // starts with \n
  ].join('');

  return result;
}

/*----------------------------------------------------------------------------*/
