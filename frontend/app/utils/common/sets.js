//------------------------------------------------------------------------------

export { toggleMember };

/** Toggle the membership of member in set.
 * @param set Set()
 * @param member string or String
 * Strings are converted to string to be stored in the set, so that set.has() will match.
 * @desc
 * Related : toggleObject(array, object) in utils/ember-devel.js
 */
function toggleMember(set, member) {
  const string = member instanceof String ? member.toString() : member;
  if (set.has(string)) {
    set.delete(string);
  } else {
    set.add(string);
  }
}

//------------------------------------------------------------------------------
