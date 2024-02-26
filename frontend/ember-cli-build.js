'use strict';

var nodeSass = require('node-sass');

const EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function (defaults) {
  const app = new EmberApp(defaults, {
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
      'bootstrapVersion': 4,
      'importBootstrapFont': false,
      'importBootstrapCSS': true
    },
    webpack: {
      stats: {
        errorDetails: true,	// equivalent to --stats-error-details
      }
    },
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
  app.import('vendor/js/divgrid/divgrid.js');
  app.import('node_modules/colresizable/colResizable-1.6.min.js');
  const bootstrapJs = 'node_modules/bootstrap/js/dist/'; // or src/
  app.import(bootstrapJs + 'tooltip.js');
  app.import(bootstrapJs + 'popover.js');
  app.import(bootstrapJs + 'button.js');
  app.import(bootstrapJs + 'tab.js');
  app.import(bootstrapJs + 'dropdown.js');
  app.import(bootstrapJs + 'util.js');
  app.import('node_modules/numeric/lib/numeric.latest.js');
  app.import('node_modules/dompurify/dist/purify.js');
  app.import('node_modules/handsontable/dist/handsontable.js');
  app.import('node_modules/tsne-js/build/tsne.min.js', {
    outputFile : 'assets/web-workers/tsne.min.js'
  });
  app.import('node_modules/vector-cosine-similarity/lib/cosineSimilarity.js', {
    outputFile : 'assets/web-workers/cosineSimilarity.js'
  });

  return app.toTree();
};
