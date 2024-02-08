'use strict';

var nodeSass = require('node-sass');

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
  let app = new EmberApp(defaults, {
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
      corejs : {compact: false}
    },

    sassOptions: {
      implementation: nodeSass
    },

    'ember-bootstrap': {
      'bootstrapVersion': 3,
      'importBootstrapFont': false,
      'importBootstrapCSS': false
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
  app.import('bower_components/d3/d3.js');
  app.import('bower_components/d3-tip/d3-tip.js');
  app.import('bower_components/handsontable/dist/handsontable.full.min.js');
  app.import('bower_components/handsontable/dist/handsontable.full.min.css');
  app.import('vendor/js/divgrid/divgrid.js');
  app.import('node_modules/colresizable/colResizable-1.6.min.js');
  app.import('node_modules/bootstrap/js/tooltip.js');
  app.import('node_modules/bootstrap/js/popover.js');
  app.import('node_modules/bootstrap/js/button.js');
  app.import('node_modules/bootstrap/js/tab.js');
  app.import('node_modules/bootstrap/js/dropdown.js');
  app.import('node_modules/numeric/lib/numeric.latest.js');
  app.import('node_modules/tsne-js/build/tsne.min.js', {
    outputFile : 'assets/web-workers/tsne.min.js'
  });
  app.import('node_modules/vector-cosine-similarity/lib/cosineSimilarity.js', {
    outputFile : 'assets/web-workers/cosineSimilarity.js'
  });

  return app.toTree();
};
