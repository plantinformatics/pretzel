const bent = require('bent');
const param = require('jquery-param');

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
  promise = exports.ontologyGetNode(id)
    .then((o) => exports.ontologyGetChildren(o));
  return promise;
};

/** 
 * remove .icon from o, and get .children if needed.

 * @return undefined if no children to get, otherwise a promise which yields
 * result when child results are complete
 */
exports.ontologyGetChildren = async function ontologyGetChildren(o) {
  const fnName = 'ontologyGetChildren';
  console.log(fnName, o.id);

  let {icon, ...result} = o;

  if ((o.type === 'term') && ((o.children === true) || (o.children && o.children.length))) {
    if (o.children === true) {
      let r = await exports.ontologyGetNode(o.id);
      result.children = r;
    }
    if (result.children.length) {
      let co = [];
      for (let i=0; i <= 1 /*result.children.length*/; i++) {
        let c1 = result.children[i],
          c2 = await ontologyGetChildren(c1);
        co.push(c2);
      }
      result.children = co;
    }
  }
  return result;
};

exports.ontologyGetNode = function (id) {
  const fnName = 'ontologyGetNode';
  console.log(fnName, id);

  const
  /** CO_321 : Wheat Traits */
  base = 'CO_321:ROOT';

  /** CO_321:ROOT?id=CO_321%3A0000304 */
  let
  queryParams = id && param({id}),
  queryParamsText = queryParams ? '?' + queryParams : '',
  endPoint = '/tree',
  url = endPoint + '/' + base + queryParamsText;

  console.log(fnName, host, endPoint, id, url);

  let promise =
    getJSON(url /*, body, headers */)
      /** expect result is an array with 1 element. */
      .then((a) => ((a.length === 1) ? a[0] : a))
      .catch(function (err) {
        console.log(fnName, endPoint, id, queryParams, err);
      });
  promise.then((ontologies) => console.log(fnName, ontologies.length));
  return promise;
};

/*----------------------------------------------------------------------------*/
