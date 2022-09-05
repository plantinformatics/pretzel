
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

export {
  stringCountString,
};
