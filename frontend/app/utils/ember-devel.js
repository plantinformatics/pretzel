import { later as run_later } from '@ember/runloop';

/*----------------------------------------------------------------------------*/
/* Various utility functions for development / debugging of Ember objects. */

const dLog = console.debug;

// -----------------------------------------------------------------------------

/** Find a parent with the nominated type. */
import $ from 'jquery';

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
  return $("#"+id)[0];
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

/** Display Ember Data store Object field values.  for devel debug - this is not a public API.
 *  Before Ember V3 this was '_internalModel.__data'
 */
const _internalModel_data = '_internalModel._recordData.__data';


/*----------------------------------------------------------------------------*/

/* related : ./common/promises.js  */

/** Run the function now or later.
 * @param later if true, then run fn in Ember.run.later()
 */
function nowOrLater(later, fn) {
  if (later) {
    run_later(fn);
  } else {
    fn();
  }
}

/** Used when result paths (or features) is a promise;  simply shows 'pending'.
 */
function promiseText(promise) {
  // Some types of promise used may have not .state().
  return (promise.state && promise.state()) || promise;
}

/*----------------------------------------------------------------------------*/

/** changes for Octane : https://v5.chriskrycho.com/journal/migrating-off-of-promiseproxymixin-in-ember-octane/ */

import ObjectProxy from '@ember/object/proxy';
import PromiseProxyMixin from '@ember/object/promise-proxy-mixin';
import { resolve } from 'rsvp';

let ObjectPromiseProxy = ObjectProxy.extend(PromiseProxyMixin);

function toPromiseProxy(valueP) {
  let proxy = ObjectPromiseProxy.create({ promise: resolve(valueP) });
  return proxy;
}

import ArrayProxy from '@ember/array/proxy';
const ArrayPromiseProxyMixin = ArrayProxy.extend(PromiseProxyMixin);

let ArrayPromiseProxy = ArrayProxy.extend(PromiseProxyMixin);

function toArrayPromiseProxy(valueP) {
  let proxy = ArrayPromiseProxy.create({ promise: resolve(valueP) });
  return proxy;
}

// -----------------------------------------------------------------------------

let objectDependenciesCache = new WeakMap();
/** Compare the values of an object for CP dependencies.
 * Previous values are stored via a WeakMap, using object as key.
 * @param object Ember Object - this of the CP
 * @param label string to label the console.debug() output
 * @param dependencies array of strings which identify the dependencies
 */
function compareDependencies(object, label, dependencies) {
  let
  previous = objectDependenciesCache.get(object),
  current = dependencies.map((d) => object.get(d));
  if (previous) {
    let changes = dependencies.map((d, i) => (previous[i] !== current[i]) && d);
    dLog(label, changes, previous, current);
  }
  objectDependenciesCache.set(object, current);
}

// -----------------------------------------------------------------------------

/** Show id and type attributes of obj.
 * @param obj Ember Object
 */
function logObj(obj)
{
  dLog(obj.id, obj._debugContainerKey);
}
/** Show parents of emberComponent, up to the root.
 * @param emberComponent
 */
function showParents(emberComponent) {
  let parent = emberComponent;
  while (parent) {
    logObj(parent);
    parent = parent.parentView;
  }
  if (parent) {
    logObj(parent);
  }
}

/** Search upwards from emberComponent, through component .parentView links,
 * stopping if matchFn(parent) is true 
 * @param matchFn  matchFn(emberComponent) -> boolean
 * matchFn may also be used to visit each component node, e.g logging component details.
 */
function findParent(emberComponent, matchFn) {
  let parent = emberComponent;
  while (parent && ! matchFn(parent)) {
    parent = parent.parentView;
  }
  return parent;
}

// -----------------------------------------------------------------------------

function blockInfo(block) { return block && [block.id, block.store.name, block.get(_internalModel_data), block.get('isCopy'), block.get('_meta._origin')]; }

// -----------------------------------------------------------------------------


export {
  parentOfType, elt0, getAttrOrCP, _internalModel_data, nowOrLater,  promiseText, toPromiseProxy,
  toArrayPromiseProxy,
  compareDependencies,
  findParent,
  blockInfo,
 };
