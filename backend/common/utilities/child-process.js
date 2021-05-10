'use strict';

/* global require */
/* global Buffer */
/* global process */

const { spawn } = require('child_process');
var fs = require('fs');

/*----------------------------------------------------------------------------*/


/**
 * @param postdata
 * @param useFile
 * @param fileName
 * @param moreParams array of params to pass as command-line params to
 * child process, after [fileName, useFile]
 * @param dataOutCb (Buffer chunk, cb) {}
 * @param cb  response node callback
 * @return child
 */
exports.childProcess = (scriptName, postData, useFile, fileName, moreParams, dataOutCb, cb) => {
  const fnName = 'childProcess';
  /** messages from child via file descriptors 3 and 4 are
   * collated in these arrays and can be sent back to provide
   * detail for / explain an error.
   */
  let errors = [], warnings = [];

  /** Each worksheet in the .xslx will result in a dataset passed
   * to upload.uploadDataset() which call cb(), so it is necessary
   * to limit this to a single call-back, using cbWrap and cbCalled.
   * It would be better to assemble an array of datasetId-s from
   * insert_features_recursive(), and pass that to cb when complete.
   * The client does not use this result value.
   *
   * Refn : async/dist/async.js : onlyOnce(fn)
   */
  let cbOrig = cb,
      cbCalled = 0;
  function cbWrap(err, message, last) {
    console.log('cbWrap', err && err.toString(), message, last);
    /* insert_features_recursive() "passes" last === undefined,
     * and when !err, message is datasetId (i.e. datasetName)
     */
    if (last || (last === undefined) || err) {
      if (cbCalled++ === 0) {
        if (err && (errors.length || warnings.length)) {
          err = [err].concat(errors).concat(warnings).join("\n");
          errors = []; warnings = [];
        }
        cbOrig(err, message);
      }
    }
  }
  cb = cbWrap;
  /** fileName : remove punctuation other than .-_, retain alphanumeric */
  if (useFile) {
    const data = new Uint8Array(Buffer.from(postData, 'binary'));
    fs.writeFile(fileName, data, (err) => {
      if (err) {
        cb(err);
      } else {
        console.log('Written', postData.length, data.length, 'to', fileName);
      }
    });
  }

  const
  /** msg.replaceDataset is defined by uploadSpreadsheet(), but not by data-json.js : submitFile()
  replaceDataset = !!msg.replaceDataset, 
   */
  currentDir = process.cwd(),
  /** In the Docker container, server cwd is /, and scriptName (e.g. uploadSpreadsheet.bash) is in /app/scripts/ */
  scriptsDir = (currentDir === "/") ? "/app/scripts" : 
    currentDir.endsWith("/backend") ? 'scripts' : 'backend/scripts',
  // process.execPath is /usr/bin/node,  need /usr/bin/ for mv, mkdir, perl
  PATH = process.env.PATH + ':' + scriptsDir,
  /** file handles : stdin, stdout, stderr, output errors, output warnings. */
  options = {env : {PATH},  stdio: ['pipe', 'pipe', process.stderr, 'pipe', 'pipe'] };
  let params = [fileName, useFile];
  if (moreParams && moreParams.length) {
    params = params.concat(moreParams);
  }
  const child = spawn(scriptName, params, options);
  child.on('error', (err) => {
    console.error(fnName, 'Failed to start subprocess.', scriptName, fileName, err.toString());
    // const error = Error("Failed to start subprocess to upload xlsx file " + fileName + '\n' + err.toString());
    cb(err/*or*/);
  });
  console.log(fnName, scriptName, postData.length, useFile, /*child,*/ fileName, postData.length, scriptsDir, currentDir);
  if (! useFile) {
    child.stdin.write(postData);
    child.stdin.end();
  }

  // On MS Windows these handles may not be 3 and 4.
  child.stdio[3].on('data', (chunk) => {
    let message = chunk.toString();
    console.log(fnName, scriptName, ' errors :', message);
    errors.push(message);
  });
  child.stdio[4].on('data', (chunk) => {
    let message = chunk.toString();
    console.log(fnName, scriptName, ' warnings :', message);
    warnings.push(message);
  });

  child.stdout.on('data', (chunk) => dataOutCb(chunk, cb));

  // since these are streams, you can pipe them elsewhere
  // child.stderr.pipe(dest);
  child.on('close', (code) => {
    console.log('child process exited with code',  code);
    if (code) {
      const error = Error("Failed processing file '" + fileName + "'.");
      cb(error);
    } else if (errors.length || warnings.length) {
      let
      errors_warnings = errors.concat(warnings).join("\n");
      errors = []; warnings = [];
      cb(errors_warnings);
    } else {
      // process each tmp/out_json/"$datasetName".json
      const message = 'Processed file ' + fileName;
      if (child.killed) {
        cb(null, message, true);
      } // else check again after timeout
    }
  });

  return child;
};

/*----------------------------------------------------------------------------*/

/* dataset upload */
function factored(msg, cb) {
  exports.childProcess('uploadSpreadsheet.bash', msg.data, true, msg.fileName, dataOutUpload, cb);
}

// msg file param from API request  {fileName, data, replaceDataset}

// params needed : this (model/dataset), replaceDataset, uploadParsedTry
let dataOutUpload = (chunk, cb) => {
    // data from the standard output is here as buffers
    // Possibly multiple lines, separated by \n,
    // completed by \n.
    const
    textLines = chunk.toString().split('\n');
    textLines.forEach((textLine) => {
      if (textLine !== "") {
        let [fileName, datasetName] = textLine.split(';');
        console.log('uploadSpreadsheet stdout data',  "'", fileName,  "', '", datasetName, "'");
        if (fileName.startsWith('Error:') || ! datasetName) {
          cb(new Error(fileName + " Dataset '" + datasetName + "'"));
        } else {
          console.log('before removeExisting "', datasetName, '"', replaceDataset);
          this.removeExisting(datasetName, replaceDataset, cb, loadAfterDelete);
        }
        function loadAfterDelete(err) {
          if (err) {
            cb(err);
          }
          else {
            fs.readFile(fileName, (err, jsonData) => {
              if (err) {
                cb(err);
              } else {
                console.log('readFile', fileName, jsonData.length);
                // jsonData is a Buffer;  JSON.parse() handles this OK.
                uploadParsedTry(jsonData);
              }
            });
          }
        };
      }
    });
};
