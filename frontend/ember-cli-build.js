/*jshint node:true*/
/* global require, module */
var EmberApp = require('ember-cli/lib/broccoli/ember-app');
var nodeSass = require('node-sass');

module.exports = function(defaults) {
  var app = new EmberApp(defaults, {
    // Add options here
    browserify: {
      transform: [
        ['babelify', {
          presets: ['es2015'],
          global: true,
          ignore: /\/node_modules\/(?!get-stream\/)/
        }], 
        ['babelify', {
          presets: ['es2015'],
          global: true,
          ignore: /\/node_modules\/(?!got\/)/
        }]
      ]
    },

    babel: {
      compact: false
    },

    sassOptions: {
      implementation: nodeSass
    },

    'ember-bootstrap': {
      'bootstrapVersion': 4,
      'importBootstrapFont': true,
      'importBootstrapCSS': true
    }
  });

  // Use `app.import` to add additional libraries to the generated
  // output files.
  //
  // If you need to use different assets in different
  // environments, specify an object as the first parameter. That
  // object's keys should be the environment name and the values
  // should be the asset to use in that environment.
  //
  // If the library that you are including contains AMD or ES6
  // modules that you would like to import into your application
  // please specify an object with the list of modules as keys
  // along with the exports of each module as its value.
  //
  app.import('bower_components/bootstrap/dist/css/bootstrap.css');
  app.import('bower_components/bootstrap/dist/js/bootstrap.min.js');
  app.import('bower_components/d3/d3.js');
  app.import('bower_components/d3-tip/d3-tip.js');
  app.import('bower_components/handsontable/dist/handsontable.full.min.js');
  app.import('bower_components/handsontable/dist/handsontable.full.min.css');
  app.import('vendor/js/divgrid/divgrid.js');
  app.import('node_modules/popper.js/dist/umd/popper.js');
  app.import('node_modules/tooltip.js/dist/umd/tooltip.js');

  app.import('bower_components/bootstrap/fonts/glyphicons-halflings-regular.woff', {
    destDir: 'fonts'
  });
  app.import('bower_components/bootstrap/fonts/glyphicons-halflings-regular.woff2', {
    destDir: 'fonts'
  });

  return app.toTree();
};
