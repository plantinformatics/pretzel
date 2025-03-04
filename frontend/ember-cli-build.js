'use strict';

/* global require */

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
      corejs : {compact: false},

      /* Some dependencies (ember-bootstrap, ember-power-select) are using
       * ember-concurrency@3.1.1, so the following is not required yet; enable it for v4 */
      // refn : http://ember-concurrency.com/docs/v4-upgrade/
      plugins: [
        // ... any other plugins
        // require.resolve("ember-concurrency/async-arrow-task-transform"),

        // NOTE: put any code coverage plugins last, after the transform.
      ],
    },

    sassOptions: {
      implementation: nodeSass
    },

    'ember-bootstrap': {
      'bootstrapVersion': 4,
      'importBootstrapFont': false,
      'importBootstrapCSS': true,
      /* added in app/templates/application.hbs : <div id="ember-bootstrap-wormhole"></div> */
      insertEmberWormholeElementToDom : false,
    },
    webpack: {
      stats: {
        errorDetails: true,	// equivalent to --stats-error-details
      },
      /* This is suggested to help with 'npm link' for local worktrees, it
       * didn't include the external package in vendor js, so 'npm pack' was
       * used instead, for @plantinformatics/vcf-genotype-brapi.
      resolve: {
        symlinks: false
      }, */
    },

    /** The following attempts to add crossorigin="anonymous" to the script tag
     * which includes chunk.*.js
     * The configuration is documented in 
     *   https://cli.emberjs.com/release/advanced-use/asset-compilation/
     *   https://github.com/jonathanKingston/ember-cli-sri
     *   https://github.com/jonathanKingston/broccoli-sri-hash
     * refn :
     *   http://www.w3.org/TR/SRI	Subresource Integrity (SRI)
     *   https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
     */
    SRI: {
      enabled: true,	// probably not needed; fingerprinting is on by default
      crossorigin: 'anonymous'
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
  // app.import('node_modules/popper.js/dist/popper.js');
  app.import('node_modules/bootstrap/dist/js/bootstrap.bundle.js');
  const bootstrapJs = 'node_modules/bootstrap/js/dist/'; // or src/
  /*
  app.import(bootstrapJs + 'tooltip.js');
  app.import(bootstrapJs + 'popover.js');
  app.import(bootstrapJs + 'button.js');
  app.import(bootstrapJs + 'tab.js');
  app.import(bootstrapJs + 'util.js');
  app.import(bootstrapJs + 'dropdown.js');
  */
  app.import('node_modules/numeric/lib/numeric.latest.js');
  app.import('node_modules/@lix/d3-tip/index.js');  // src/
  app.import('node_modules/dompurify/dist/purify.js');

  /* Either import handsontable here, or
   * via <link rel="stylesheet" > and <script > in app/index.html
   */
  const HoT = 'node_modules/handsontable/';
  app.import(HoT + 'dist/handsontable.full.min.js');  // handsontable.js
  app.import(HoT + 'dist/handsontable.full.css'); // handsontable.css

  // app.import('node_modules/interval-bins/dist/interval-bins.js');
  // app.import('node_modules/@plantinformatics/vcf-genotype-brapi/dist/vcf-genotype-brapi.js');

  app.import('node_modules/tsne-js/build/tsne.min.js', {
    outputFile : 'assets/web-workers/tsne.min.js'
  });
  app.import('node_modules/vector-cosine-similarity/lib/cosineSimilarity.js', {
    outputFile : 'assets/web-workers/cosineSimilarity.js'
  });

  return app.toTree();
};
