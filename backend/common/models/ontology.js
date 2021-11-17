'use strict';

var acl = require('../utilities/acl');

var { ontologyGetTree } = require('../utilities/get-ontology');

/* global process */
/* global require */
/* global module */

const cacheLibraryName = '../utilities/results-cache'; // or 'memory-cache' (same API)
var cache = require(cacheLibraryName);

/*----------------------------------------------------------------------------*/

const trace = 1;

/*----------------------------------------------------------------------------*/


module.exports = function(Ontology) {

  /*--------------------------------------------------------------------------*/

  Ontology.getTree = function (root, cb) {
    const
    fnName = 'getTree',
    /** param root (or species name) will be added, to support other species.  */
    // root = "CO_321",
    paramError = ! root.match(/^CO_[0-9]{3}$/),
    cacheId = fnName + root,
    /** define refreshCache true to replace the cached result. */
    refreshCache = false,
    result = ! refreshCache && cache.get(cacheId);
    if (paramError) {
      cb(paramError);
    } else
      if (result) {
        if (trace /*> 1*/) {
          console.log(fnName, root, cacheId, 'get', result[0] || result);
        }
        cb(null, result);
      } else {
        let
        ontologyTreeP = ontologyGetTree();
        ontologyTreeP.then((ontologyTree) => {
          console.log(fnName, ontologyTree);
          if (trace /*> 1*/) {
            console.log(fnName, root, cacheId, 'put', ontologyTree);
          }
          cache.put(cacheId, ontologyTree);
          cb(null, ontologyTree);
        })
        // signature of .catch() error function matches cb : (err)
          .catch(cb);
      }
  };

  /*--------------------------------------------------------------------------*/

  Ontology.remoteMethod('getTree', {
    accepts: [
      {arg: 'rootId', type: 'string', required: true},
    ],
    returns: {type: 'array', root: true},
    description: "Request ontology tree of Ontology API source"
  });

  /*--------------------------------------------------------------------------*/

  acl.assignRulesRecord(Ontology);

  Ontology.disableRemoteMethodByName("findById");

};

