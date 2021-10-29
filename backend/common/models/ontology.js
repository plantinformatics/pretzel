'use strict';

var acl = require('../utilities/acl');

var { ontologyGetTree } = require('../utilities/get-ontology');

/* global process */
/* global require */
/* global module */

module.exports = function(Ontology) {

  /*--------------------------------------------------------------------------*/

  Ontology.getTree = function (cb) {
    const fnName = 'getTree';
    var ontologyTreeP = ontologyGetTree();
    ontologyTreeP.then((ontologyTree) => {
      console.log(fnName, ontologyTree);
      cb(null, ontologyTree);
    })
      .catch((err) => cb(err));
  };

  /*--------------------------------------------------------------------------*/

  Ontology.remoteMethod('getTree', {
    accepts: [
    ],
    returns: {type: 'array', root: true},
    description: "Request ontology tree of Ontology API source"
  });

  /*--------------------------------------------------------------------------*/

  acl.assignRulesRecord(Ontology);

  Ontology.disableRemoteMethodByName("findById");

};

