'use strict';

const bent = require('bent');
const param = require('jquery-param');

/*----------------------------------------------------------------------------*/

const { ErrorStatus } = require('../utilities/errorStatus.js');

/*----------------------------------------------------------------------------*/

/* global require */
/* global exports */

/*----------------------------------------------------------------------------*/

const trace = 1;

const cropOntologyDomain = "cropOntology.org";
const protocol = "https://";

/*----------------------------------------------------------------------------*/
const
host = cropOntologyDomain,
getJSON = bent(protocol + host, 'json');


/*----------------------------------------------------------------------------*/


exports.ontologyGetTree = function (id) {
  const fnName = 'ontologyGetTree';
  console.log(fnName, id);

  let
  promise = exports.ontologyGetNode(/*rootId*/ id, /*id*/undefined)
    .then((o) => o && exports.ontologyGetChildren(id, o));
  return promise;
};

/** 
 * remove .icon from o, and get .children if needed.

 * @return undefined if no children to get, otherwise a promise which yields
 * result when child results are complete
 */
exports.ontologyGetChildren = async function ontologyGetChildren(rootId, o) {
  const fnName = 'ontologyGetChildren';
  console.log(fnName, rootId, o.id);

  let {icon, ...result} = o;

  if ((o.type === 'term') && ((o.children === true) || (o.children && o.children.length))) {
    if (o.children === true) {
      let r = await exports.ontologyGetNode(rootId, o.id);
      result.children = r;
    }
    if (result.children.length) {
      let co = [];
      /** use 2 instead of .length for a small result for development. */
      const testing = false;
      let length = testing ? Math.min(2, result.children.length) : result.children.length;
      for (let i=0; i < length; i++) {
        if (! result.children[i]) {
          console.log(fnName, rootId, result, result.children.length, i, result.children);
        }
        let c1 = result.children[i],
          c2 = await ontologyGetChildren(rootId, c1);
        co.push(c2);
      }
      result.children = co;
    }
  }
  return result;
};

/**
 * @param rootId  an ontology root ID
 * @param id  may be undefined, in which case the rootId only is used and ?id= query param is not given.
 */
exports.ontologyGetNode = function (rootId, id) {
  const fnName = 'ontologyGetNode';
  console.log(fnName, rootId, id);

  const
  /** e.g. CO_321:ROOT : Wheat Traits */
  base = rootId + ':ROOT';

  /** e.g. CO_321:ROOT?id=CO_321%3A0000304 */
  let
  queryParams = id && param({id}),
  queryParamsText = queryParams ? '?' + queryParams : '',
  endPoint = '/tree',
  url = endPoint + '/' + base + queryParamsText;

  console.log(fnName, host, endPoint, rootId, id, url);

  /** If the promise value returned does not include .catch() or if
   * the .catch() throws then the server exits.
   * So instead, undefined is returned, which is handled in Ontology.getTree().
   */
  let promise =
    getJSON(url /*, body, headers */)
      /** expect result is an array with 1 element. */
      .then((a) => ((a.length === 1) ? a[0] : a))
      .catch(function (err) {
        console.log(fnName, endPoint, id, queryParams, err);
        // throw ErrorStatus(404, fnName);
      });
  promise.then((ontologies) => console.log(fnName, ontologies && ontologies.length));
  return promise;
};

/*----------------------------------------------------------------------------*/
