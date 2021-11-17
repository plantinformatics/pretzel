import EmberObject, { computed } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { A } from '@ember/array';

import { thenOrNow } from '../../utils/common/promises';
import { reduceIdChildrenTree } from '../../utils/value-tree';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

const trace = 1;

/*----------------------------------------------------------------------------*/

const
protocol = "https://",
apiURL = 'www.cropontology.org';


function urlFor(apiName, param) {
  let url = protocol + apiURL + '/' + apiName + '/' + param;
  return url;
}


/*----------------------------------------------------------------------------*/


/** QTLs, which are Features, may have an attribute values.Ontology, which is a
 * code value equivalent to values.Trait, offering a more specific and
 * consistent identification.
 *
 * This service maps from ontology IDs to name (and description) provided by
 * ontologies such as www.cropOntology.org.
 */
export default Service.extend({
  ajax : service(),
  auth : service(),

  /*--------------------------------------------------------------------------*/
  // results from direct requests to CropOntology.org API
  /** object [ontologyId] -> json */
  ontologies : EmberObject.create(),
  attributes : EmberObject.create(),

  // results from requests via Pretzel backend server, which caches results from CropOntology.org API.
  /** trees[rootId] is the result of getTree(rootId) */
  trees : EmberObject.create(),
  /** byId[rootId][ontologyId] references into trees[rootId] children, by ontologyId */
  byId :  EmberObject.create(),

  /*--------------------------------------------------------------------------*/

  setOntology(ontologyId, json) {
    this.ontologies.set(ontologyId, json);
  },
  ontologyIdType(ontologyId) {
    let
    typeName =
      (ontologyId.match(/^CO_[0-9]+:[0-9]+$/) && 'attributes') ||
      (ontologyId.match(/^CO_[0-9]+$/) && 'ontology');
    return typeName;
  },
  /** Given a get-ontology API result, extract the name from it  */
  extractName_ontology(json, ontologyId) {
    /** use the name of the first term. 
     *
     * example reult of get-ontology :
     * {
     *   "CO_338:0000002": {
     *     "name": {
     *       "english": "Pod weight"
     *     },
     * ...},
     * ...}
     */
    let terms = Object.keys(json),
        name = json[terms[0]].name;
    return name;
  },
  /** Given a get-attributes API result, extract the name from it  */
  extractName_attributes(json, ontologyId) {
    /** the first array element seems to be name (could search the array).
     * use the .value.english of the first array element.
     *
     * example result of get-attributes :
     *   [{
     *     "key": "name",
     *     "value": "{\"english\":\"Ascochyta blight resistance\"}"
     *   },
     *   ... ]
     */
    let
    valueString = json[0].value,
    value = JSON.parse(valueString),
    name = value.english;
    return name;
  },
  /** If the given string ontologyId is a valid cropOntology Ontology ID;
   * if not return undefined.
   * If the Ontology description has already been requested from cropOntology
   * API and is cached, use the name, otherwise request it and return undefined.
   */
  getName(ontologyId) {
    /** If the ontologyId is a termId : CO_338:0000039 then use get-attributes
     * If the ontologyId is a parentId : CO_338 then use get-ontology.
     */
    let
    name,
    typeName = this.ontologyIdType(ontologyId);
    if (typeName) {
      let oj = this.get(typeName).get(ontologyId);
      if (oj) {
        name = this.get('extractName_' + typeName)(oj, ontologyId);
      } else {
        this.request('get-' + typeName, ontologyId)
          .then((j) => {
            // j may be undefined, store that as null.
            this.get(typeName).set(ontologyId, j || null);
          });
      }
    }
    return name;
  },
  request(apiName, ontologyId) {
    const fnName = 'request';
    /** e.g. http://www.cropontology.org/get-ontology/CO_334 */
    let
    url = urlFor(apiName, ontologyId),
    p = this.get('ajax').request(url)
      .catch((err) => {
        dLog(fnName, err, ontologyId);
        return undefined;
      });

    return p;
  },


  /*--------------------------------------------------------------------------*/

  getNameViaPretzelServer(ontologyId) {
    /** From ontologyId, determine the root ID, and use that result or request it.
     */
    let
    rootIdMatch = ontologyId.match(/^(CO_[0-9]+):/),
    rootId = rootIdMatch && rootIdMatch[1],
    tree, name;
    if (! rootId) {
      dLog('getNameViaPretzelServer', 'not a CropOntology ID:', ontologyId);
    } else if ((tree = this.trees.get(rootId) || this.getTree(rootId))) {
      name = thenOrNow(tree, (t) => this.nameLookup(rootId, ontologyId));
    }
    return name;
  },
  nameLookup(rootId, ontologyId) {
    let
    tree = this.byId[rootId],
    value = tree && tree[ontologyId],
    name = value?.text;
    return name;
  },
  tree2ids(rootId, tree) {
    function addId(result, parentKey, index, value) {
      result[value.id] = value;
      return result;
    };
    let byId = EmberObject.create();
    /** reduceIdChildrenTree() does not apply fn to root tree. */
    addId(byId, undefined, 0, tree);
    /** result is === byId */
    reduceIdChildrenTree(tree, addId, byId);
    dLog('tree2ids', rootId, tree, byId);
    return byId;
  },



  /*--------------------------------------------------------------------------*/

  /**
   * @return tree value if already received, otherwise promise.
   */
  getTree(rootId) {
    const fnName = 'getTree';

    if (! rootId) {
      /** used in get-ontology.js : ontologyGetNode() : base */
      rootId = 'CO_321';  // full ID has appended :ROOT
    }
    let trees = this.get('trees'),
        tree = trees.get(rootId);
    if (! tree) {
      dLog(fnName, rootId);
      let
      promise =
        this.get('auth').ontologyGetTree(rootId, /*options*/{});
      // placeholder to prevent repeated request
      trees.set(rootId, promise);

      promise.then((treeValue) => {
        (trace > 1) && dLog(fnName, treeValue);
        trees.set(rootId, treeValue);
        this.byId[rootId] = this.tree2ids(rootId, treeValue);
      });

      tree = promise;
    }
    return tree;
  },

  /*--------------------------------------------------------------------------*/

});


/*----------------------------------------------------------------------------*/
