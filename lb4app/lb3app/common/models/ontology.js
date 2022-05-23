'use strict';

const Queue = require('promise-queue');

var { queueAppend } = require('../utilities/request-queue');

var acl = require('../utilities/acl');

var { ontologyGetTree } = require('../utilities/get-ontology');

/* global process */
/* global require */
/* global module */

const cacheLibraryName = '../utilities/results-cache'; // or 'memory-cache' (same API)
var cache = require(cacheLibraryName);

/*----------------------------------------------------------------------------*/

const trace = 1;

// -----------------------------------------------------------------------------

const queue = new Queue(/*concurrency:*/ 1);

/*----------------------------------------------------------------------------*/


module.exports = function(Ontology) {

  /*--------------------------------------------------------------------------*/

  /**
   * @param root  root ID of an Ontology  e.g. "CO_321" (CropOntology)
   */
  Ontology.getTree = function (root, cb) {
    const
    fnName = 'getTree',
    /** param root (or species name) will be added, to support other species.  */
    paramError = ! root.match(/^CO_[0-9]{3}$/),
    /** normally testId is ''; give it a value to avoid overwriting good results
     * with test results; e.g. ontologyGetChildren() : testing=true
     */
    testId = '', // '_test1',
    cacheId = fnName + '_' + root + testId,
    /** define refreshCache true to replace the cached result. */
    refreshCache = false;  // e.g. root === 'CO_338'; // 
    let result = ! refreshCache && cache.get(cacheId);
    // enable this to copy results from previous cacheId (without _)
    if (! result && false) {
      let cacheIdOld = fnName + root;
      result = cache.get(cacheIdOld);
      if (result) {
        console.log(fnName, 'copy result from', cacheIdOld, 'to', cacheId);
        cache.put(cacheId, result);
      }
    }
    if (paramError) {
      cb(paramError);
    } else
      if (result) {
        if (trace > 1) {
          console.log(fnName, root, cacheId, 'get', result[0] || result);
        }
        cb(null, result);
      } else {
        queueAppend(requestFn, queue, 'requestName', cb);

        function requestFn(cb) {
        let
        ontologyTreeP = ontologyGetTree(root)
        .then((ontologyTree) => {
          console.log(fnName, ontologyTree);
          if (trace > 1) {
            console.log(fnName, root, cacheId, 'put', ontologyTree);
          }
          cache.put(cacheId, ontologyTree);
          cb(null, ontologyTree);
        })
        // signature of .catch() error function matches cb : (err)
          .catch(cb);
        return ontologyTreeP;
        }
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

