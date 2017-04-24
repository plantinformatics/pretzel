/*jshint node:true*/
/* global require, module */
var EmberApp = require('ember-cli/lib/broccoli/ember-app');

module.exports = function(defaults) {
  var app = new EmberApp(defaults, {
    // Add options here
    // Attempt to suppress minifyJS during devel; this option suppresses this message :
    //   [BABEL] Note: The code generator has deoptimised the styling of "ember-test/components/draw-map.js" as it exceeds the max of "100KB".
    // but draw-map.js is still minified.
    /*
    minifyJS: {
      enabled: false,
      options: {
        exclude: ["** /draw-map.js"]
      }
    },
    */
    minifyCSS: {
      enabled: false
    },
    sourcemaps: {
      enabled: true
    }
  });
  if (app.env === 'development') {
    console.log("frontend/ember-cli-build.js : app.options.minifyJS", app.options.minifyJS,
               "sourcemaps", app.options.sourcemaps);
  /*
    app.options.minifyJS || (app.options.minifyJS = {options: {}});
    app.options.minifyJS.options.
      // exclude vendor minified files
      exclude = ["assets/ember-test.js"];
*/
  }

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
  app.import('vendor/js/divgrid/divgrid.js');

  return app.toTree();
};
