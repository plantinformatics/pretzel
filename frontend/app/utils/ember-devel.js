/* global Ember */

/*----------------------------------------------------------------------------*/
/* Various utility functions for development / debugging of Ember objects. */

/** Find a parent with the nominated type. */
function parentOfType(typeName) {
  let parent = this.parentView;
  while (parent && (parent._debugContainerKey !== typeName))
  {
    parent = parent.parentView;
  }
  return parent;
}
/** @return the jquery handle of the element with the given id.
 * Usage e.g. where component is an Ember Component object
 * elt0(component.elementId || component.parentView.elementId));
 */
function elt0(id) {
  /* first added in entry-expander.js, then entry-values.js */
  return Ember.$("#"+id)[0];
}

/*----------------------------------------------------------------------------*/

export { parentOfType, elt0 };
