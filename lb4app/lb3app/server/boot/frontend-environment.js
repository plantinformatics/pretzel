'use strict';

var fs = require('fs');
var path = require('path');

module.exports = function frontendEnvironment(server) {

  let indexPath = path.resolve(__dirname, '../../../client/index.html')

  fs.readFile(indexPath, function (error, data) {
    if (error) {
      console.warn(error)
      console.warn('There was an issue reading the index.html file. Have you built and installed the frontend files?');
    } else {
      // console.log("BEFORE ==========================", data.toString())
      let configStart = '<script name="pretzel">'
      let configEnd = '</script>'
      let indexData = data.toString()
      let startIndex = indexData.indexOf(configStart)
      let partialData = indexData.substring(startIndex)
      let endIndex = partialData.indexOf(configEnd)
      let lengthScript = endIndex + configEnd.length
      let productStart = indexData.substring(0, startIndex)
      let productEnd = indexData.substring(startIndex + lengthScript)
      let pretzelConfig = configStart + `window['AUTH'] = '${process.env.AUTH}'` + configEnd
      let productComplete = productStart + pretzelConfig + productEnd
      // console.log("AFTER ==========================", productComplete)

      fs.writeFile(indexPath, productComplete, function (err) {
        if (err)  {
          console.log(err);
          console.error('There was an issue updating the index.html file. Do you have write permission?');
          process.exit(1);
        }
      })
    }
  })
};
