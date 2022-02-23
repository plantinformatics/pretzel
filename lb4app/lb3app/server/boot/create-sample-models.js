'use strict';

var load = require('../../common/utilities/load')
var upload = require('../../common/utilities/upload')

module.exports = function(app) {
  // paths are based on cwd of process
  // let files = ['../../resources/90k_consensus.json.gz']
  let files = ['../path/to/file.json.gz']

  // files.forEach(function(file) {
  //   load.fileGzip(file)
  //   .then(function(data) {
  //     // completed additions to database
  //     return upload.jsonCheckDuplicate(data, app.models)
  //   })
  //   .catch(function(err) {
  //     console.log('ERROR', err)
  //   })

  // })

};
