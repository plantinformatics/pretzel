import EmberObject, { computed } from '@ember/object';
import { alias } from '@ember/object/computed';
import Service, { inject as service } from '@ember/service';
import { A } from '@ember/array';

import { thenOrNow } from '../../utils/common/promises';
import { reduceIdChildrenTree } from '../../utils/value-tree';

//------------------------------------------------------------------------------

/*global d3 */

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
  block : service('data/block'),
  controls : service(),
  queryParams: service('query-params'),

  //----------------------------------------------------------------------------

  urlOptions : alias('queryParams.urlOptions'),

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
  /** List of Ontology Root IDs received. */
  rootsReceived : A(),

  /*--------------------------------------------------------------------------*/

  treesForData : computed('block.ontologyRoots', function () {
    let
    treesP = this.get('block.ontologyRoots').then((roots) => {
      let 
      treePs = roots.map((rootId) => this.getTree(rootId));
      // dLog('treesForData', treePs);
      /** multi-root tree */
      let
      mtreeP = Promise.all(treePs)
        .then(
          (trees) => {
            /** [[rootId, tree], ...] */
            let idTrees = trees.map((t, i) => [roots[i], t]),
                multiTree = Object.fromEntries(idTrees);
            return multiTree;
          });
      return mtreeP;
    });
    return treesP;
  }),

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
   * return the .text description of the Ontology (if available),
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
      /** based on serverTabSelected or primary */
      apiServer = this.get('controls.apiServerSelectedOrPrimary'),
      promise =
        this.get('auth').ontologyGetTree(apiServer, rootId, /*options*/{});
      // placeholder to prevent repeated request
      trees.set(rootId, promise);

      promise.then((treeValue) => {
        (trace > 1) && dLog(fnName, treeValue);
        trees.set(rootId, treeValue);
        this.byId[rootId] = this.tree2ids(rootId, treeValue);
        this.rootsReceived.pushObject(rootId);
      });

      tree = promise;
    }
    return tree;
  },

  /*--------------------------------------------------------------------------*/

  /** Incremented when ontology_colour_scale is changed, for dependencies. */
  ontologyColourScaleUpdateCount : 0,

  /** initially add all Ontology IDs to the colour scale
   */
  ontology_colour_scale : computed('ontologyCollation.ontologyId2Node',  function () {
    /** similar : see also axis.js : trait_colour_scale */
    let scale = d3.scaleOrdinal().range(d3.schemeCategory10);
    return scale;
  }),


  /** Lookup the colour for ontologyId from the colour scale.
   * scale uses Ontology Id - including traits and terms.

   * Lookup traverses upward from the given OntologyId; if that OntologyId is
   * not currently in the colour scale, traverse to the parent node in the
   * Ontology, and check if that OntologyId is in the colour scale.
   * Stop at the ROOT of the Ontology, and return undefined if the ROOT
   * OntologyId is not in the colour scale.
   */
  qtlColour(ontologyId) {
    let ontology_colour_scale = this.get('ontology_colour_scale');
    let ids = ontology_colour_scale.domain();
    let found;
    let treeData = this.get('ontologyCollation'),
        id2n = treeData.get('ontologyId2Node._result');
    dLog('qtlColour', id2n);
    let colour;
    let isRoot;
    /** after devel, can reduce this to : && id2n && (parent = id2n[ontologyId]?.parent?.id) */
    let parent = true;
    while (! (found = ids.includes(ontologyId)) && ! (isRoot = ontologyId.match(':ROOT')) && parent ) {
      if (id2n) {
        parent = id2n[ontologyId]?.parent;
        if (parent) {
          dLog('qtlColour', ontologyId, parent, parent.id);
          ontologyId = parent.id;
        }
      }
    }
    if (found) {
      colour = ontology_colour_scale(ontologyId);
    }

    return colour;
  },


  /**   click on tree : apply the configured algorithm, which colours either the children or the siblings
   */
  ontologyClick(ontologyId) {
    /** qtlColourHierarchy() is suited to drilling-in investigation, and
     * qtlColourLevel() provides an overview of a level.
     *
     * qtlColourLevel() does not return colour, because of promises; ok - not
     * required because valuesColour will update element colour.
     */
    let colour = (this.get('controls.view.ontologyClick') === 'Hierarchy') ||
        this.get('urlOptions.qtlColourHierarchy') ?
        this.qtlColourHierarchy(ontologyId):
        this.qtlColourLevel(ontologyId);
    return colour;
  },

  /**   click on tree : remove node's children from colour scale, and ensure that node is in colour scale
   */
  qtlColourHierarchy(ontologyId) {
    let ontology_colour_scale = this.get('ontology_colour_scale');
    let treeData = this.get('ontologyCollation'),
        id2n = treeData.get('ontologyId2NodeFor._result');
    let ids = ontology_colour_scale.domain();

    if (id2n && ids.length) {
      let node = id2n[ontologyId];
      let reducedIds = this.uncolourChildren(ids, node);
      ontology_colour_scale.domain(reducedIds);
    }

    /** ensure that node is in colour scale */
    let colour = ontology_colour_scale(ontologyId);
    this.incrementProperty('ontologyColourScaleUpdateCount');
    /** the caller could colour the clicked element  */
    return colour;
  },

  /** remove node's children from colour scale */
  uncolourChildren(domainIds, tree) {
    function removeId(ids, parentKey, index, value) {
      /** don't remove the clicked node (tree), only its children.  */
      if (parentKey) {
        let domainIndex = ids.indexOf(value.id);
        if (domainIndex !== -1) {
          ids.splice(domainIndex, domainIndex + 1);
        }
      }
      return ids;
    };
    /** result is === domainIds */
    reduceIdChildrenTree(tree, removeId, domainIds);
    dLog('uncolourChildren', tree, domainIds);
    return domainIds;
  },

  //----------------------------------------------------------------------------

  /** Colour all children of the given node, and nodes of other Ontologies at the same level.
   */
  qtlColourLevel(ontologyId) {
    let ontology_colour_scale = this.get('ontology_colour_scale');
    let treeData = this.get('ontologyCollation');
    let id2nP = treeData.get('ontologyId2NodeFor');
    let levelIds;

    id2nP.then((id2n) => {
      let node = id2n[ontologyId];
      if (false) {
        /** colourChildren() colours the siblings of the clicked element,
         * whereas colourType() colours nodes at the same level in other
         * branches / ROOTs.
         */
        levelIds = this.colourChildren(node.parent);
        setScaleDomain.apply(this, [levelIds]);
      } else {
        let treeP = treeData.get('blockFeatureOntologiesTreeGrouped');
        treeP.then((tree) => {
          /** There are 2 levels with .type === 'term' : ROOTs and their children.
           * Distinguish between these 2 levels, using the invented type 'ROOT'.  */
          let type = node.id.match(':ROOT') ? 'ROOT' : node.type;
          levelIds = this.colourType(tree, type);
          setScaleDomain.apply(this, [levelIds]);
        });
      }

      function setScaleDomain(levelIds) {
      ontology_colour_scale.domain(levelIds);

      this.incrementProperty('ontologyColourScaleUpdateCount');
      }
    });
  },

  /** replace domain of  colour scale with children of node (tree) */
  colourChildren(tree) {
    /** tree may be an .id / .children tree, or otherwise, if the children of tree are ROOT-s, tree is just e.g.
     * Object {
     *   CO_338: Object { text: "Chickpea traits", id: "CO_338:ROOT", type: "term", ... },
     *   CO_321: Object { text: "Wheat traits", id: "CO_321:ROOT", type: "term", children: Array(7) [ {...}, ...], id: "CO_321:ROOT", name: "[CO_321:ROOT]  Wheat traits", parent: (tree) },
     *   ... }
     */
    let
    children = tree.children || Object.values(tree),
    domainIds = children.mapBy('id');
    dLog('colourChildren', tree, domainIds);
    return domainIds;
  },


  //----------------------------------------------------------------------------

  /** replace domain of colour scale with .id of nodes at the given level of the tree */
  colourType(tree, type) {

    function addId(ids, parentKey, index, value) {
      /** There are 2 levels with .type === 'term' : ROOTs and their children.
       * Distinguish between these 2 levels.
       * Level above ROOTs does not have .id / .children / .type
       */
      let isRoot = !!value.id?.match(':ROOT'),
          matchType = (type === 'ROOT') ? 'term' : type;
      /** check if (type === 'ROOT') implies isRoot  */
      let match = (isRoot === (type === 'ROOT')) && (value.type === matchType);
      if (match) {
        ids.push(value.id);
      }
      return ids;
    };

    let domainIds = reduceIdChildrenTree(tree, addId, []);
    dLog('colourType', type, tree, domainIds);
    return domainIds;
  },

  //----------------------------------------------------------------------------


});



/*----------------------------------------------------------------------------*/
