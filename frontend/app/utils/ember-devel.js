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

/** Get an attribute of an object which may be an ember store object, or not.
 * Ember data operations such as findAll() will return ember store objects,
 * and ajax requests which return JSON will be parsed into plain JS objects.
 * Further details in comment in axis-1d.js : @see keyFn()
 */
function getAttrOrCP(object, attrName) {
  return object.get ? object.get(attrName) : object[attrName];
}

/*----------------------------------------------------------------------------*/

export { parentOfType, elt0, getAttrOrCP };
