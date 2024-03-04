
// -----------------------------------------------------------------------------

/** Count occurrences of stringSearch in string.
 *
 * from : https://stackoverflow.com/a/10671743/18307804, method 3, Lorenz Lo Sauer.
 * https://stackoverflow.com/a/51493288/18307804 : Damion Dooley reports this is the fastest on Node.js v.6, of those methods.
 *
 * Copied from pretzel/lb4app/lb3app/common/utilities/child-process.js
 */
function stringCountString(string, stringSearch) {
  for (
    var count=-1, index=-2;
    index != -1;
    count++, index=string.indexOf(stringSearch, index+1)
  );
  return count;
}

// -----------------------------------------------------------------------------

/** Convert the given text to TitleCase aka EditCase or PascalCase
 * (https://en.wikipedia.org/wiki/Title_case, see also CamelCase, which has a
 * leading lower-case https://en.wikipedia.org/wiki/Camel_case).
 *
 * extract from : https://stackoverflow.com/a/7225450/18307804, ZenMaster
 * (there are Ember utility functions for this also ...)
 */
function toTitleCase(text) {
  const result = text.charAt(0).toUpperCase() + text.slice(1);
  return result;
}

// -----------------------------------------------------------------------------

export {
  stringCountString,
  toTitleCase,
};

//-------------------------------------------------------------------------------

export { ensureTrailingString }
/** Ensure that the given string ends with the given suffix, which may be a multi-char string.
 * @param string
 * @param suffix
 * @desc
 * Usage e.g. ensureTrailingString(apiHost, '/')
 */
function ensureTrailingString(string, suffix) {
  if (! string.endsWith(suffix)) {
    string += suffix;
  }
  return string;
}

//-------------------------------------------------------------------------------
