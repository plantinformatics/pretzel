import { later as run_later } from '@ember/runloop';
import { getOwner, setOwner } from '@ember/application';

/*----------------------------------------------------------------------------*/
/* Various utility functions for development / debugging of Ember objects. */

const dLog = console.debug;

// -----------------------------------------------------------------------------

/** Used only in elt0() */
import $ from 'jquery';

//------------------------------------------------------------------------------

/** Use .addObject() or .removeObject() to toggle the presence of object in array.
 *
 * Also see toggleString() in utils/common/arrays.js, which matches String
 * values, which this function does not do.  If object is a String, and array
 * contains a String or string with the same string value, this function will
 * not match, and will add another object instead of removing the matching value.
 * toggleMember() in utils/common/sets.js also matches String values, by
 * converting to string.
 *
 * @param array instance of Ember.A() or equivalent, with methods :
 * .includes(object) -> boolean, and with signature function (object) :
 * .addObject() and .removeObject()
 * @param object
 * @return true iff object was added to array.
 * i.e. array now includes object
 */
function toggleObject(array, object) {
  const includes = array.includes(object);
  if (includes) {
    array.removeObject(object);
  } else {
    array.addObject(object);
  }
  return ! includes;
}


//------------------------------------------------------------------------------

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
 *  In Ember V3 this was '_internalModel._recordData.__data'
 *  In Ember V4 there is no apparent simple way to access record data, so just display .id :
 */
const _internalModel_data = 'id';

//------------------------------------------------------------------------------

/** ms per second */
const SecondMs = 1000;

/** Poll until condition() is true, then do action().
 * Initial poll wait time is pollTime, increasing by backOffFactor for each poll.
 * @param label text to identify use in trace
 * @param taskGetter  function returning task which performs this function
 * @param condition function
 * @param action  function to execute when condition() is true
 * @param pollTime  ms to wait for each poll
 * @param backOffFactor increase pollTime after each poll, up to max 60sec
 * @desc
 * Usage e.g. :   pollTask : task(pollTaskFn).keepLatest(), ...  this.pollTask.perform();
 *
 * Muliple uses are not yet supported or required;  could wrap in a closure or class.
 */
const  pollTaskFn = function * (label, taskGetter, condition, action, pollTime, backOffFactor) {
  const fnName = 'pollTaskFn';
  if (condition()) {
    dLog(fnName, 'action', label, pollTime);
    action();
  } else {
    dLog(fnName, label, 'wait', pollTime);
    pollTime = Math.min(60 * SecondMs, pollTime * backOffFactor);
    const pollTask = taskGetter();
    run_later(() => pollTask.isRunning || pollTask.perform(label, taskGetter, condition, action, pollTime, backOffFactor), pollTime);
  }
};

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

//------------------------------------------------------------------------------

/** Apply addObjects() to array for each of the given arrays.
 * @return array
 */
function addObjectArrays(array, arrays) {
  /** result === array */
  const result = arrays.reduce((union, add) => union.addObjects(add), array);
  return result;
}

//------------------------------------------------------------------------------

/** Remove all elements from the array, without replacing the array.
 * @param array
 */
function arrayClear(array) {
  // or array.length = 0;
  if (array.length) {
    array.removeAt(0, array.length);
  }
}

// -----------------------------------------------------------------------------

let objectDependenciesCache = new WeakMap();
/** Compare the values of an object for CP dependencies.
 * Previous values are stored via a WeakMap, using object as key,
 * so this only supports 1 compareDependencies() per object, i.e. 1 CP;
 * that limit can be passed by using label as an additional level of key.
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

//------------------------------------------------------------------------------

export { objectAttributeChanged };
/** Record the name of an ember data object field attribute which has changed
 * and should be included in subsequent PATCH to server REST API.
 *
 * There are some modules which could support this, but they don't appear to
 * have been updated to Ember v4 :
 *  https://github.com/ef4/ember-data-relationship-tracker
 *  https://www.npmjs.com/package/ember-data-relationship-tracker
 *  https://www.npmjs.com/package/ember-data-relationship-dirty-tracking
 *  https://github.com/danielspaniel/ember-data-change-tracker
 *  https://github.com/jpoiri/ember-dirtier
 */
function objectAttributeChanged(object, attributeName) {
  const
  key = Symbol.for('attributesToSave'),
  array = object[key] || (object[key] = []);
  array.push(attributeName);
}

//------------------------------------------------------------------------------

export { setupControllerModelOwnerTarget };
/** Used by routes to set up controller.model, controller.target, and owner of this.
 * @param controller
 * @param model
 * @param this  route
 * Usage : in class GroupsRoute extends Route { :   setupController = setupController;
 */
function setupControllerModelOwnerTarget(controller, model) {
  this._super(controller, model);
  const fnName = 'routes/' + this.fullRouteName + ':setupController';
  dLog(fnName, 'model', model);
  if (controller.model !== model) {
    dLog(fnName, 'set model', model);
    controller.set('model', model);
  }
  if (! getOwner(controller)) {
    const container = getOwner(this);
    setOwner(controller, container);
    dLog(fnName, 'set controller owner', container, controller, this);
  }
  // this seems required atm - not clear why
  if (! controller.target) {
    dLog(fnName, 'set controller.target', this, this.routeName, controller, controller._debugContainerKey);
    controller.target = this;
  }
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
  toggleObject,
  parentOfType, elt0, getAttrOrCP, _internalModel_data,
  pollTaskFn,
  nowOrLater,  promiseText, toPromiseProxy,
  toArrayPromiseProxy,
  arrayClear,
  addObjectArrays,
  compareDependencies,
  findParent,
  blockInfo,
 };
