'use strict';

/* global require */
/* global Buffer */
/* global process */
/* global exports */

const { spawn } = require('child_process');
var fs = require('fs');

//------------------------------------------------------------------------------

const trace = 1;

/*----------------------------------------------------------------------------*/


/**
 * @param postdata
 * @param useFile
 * @param fileName
 * @param moreParams array of params to pass as command-line params to
 * child process, after [fileName, useFile]
 * @param dataOutCb (Buffer chunk, cb) {} -> finished.
 * If child process closes with status 0 (OK) and sent no output, then
 * dataOutCb will be called with chunk === null
 * See param progressive.
 * See dataOutReplyClosureLimit() (which can limit outout to nLines), and dataOutReplyClosure().
 * If the callback returns truthy then do not call it again;
 * if this truthy return value !== true then pass it as result to cb.
 * @param cb  response node callback
 * @param progressive true means pass received data back directly to
 * dataOutCb, otherwise catenate it and call dataOutCb just once when
 * child closes
 * If progressive then the dataOutCb can catenate the chunks and return them
 * when finished.
 * @return child
 */
exports.childProcess = (scriptName, postData, useFile, fileName, moreParams, dataOutCb, cb, progressive) => {
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
    if (trace) {
      // message may be string or (features counts) array.
      const messageSlice = (typeof message === 'string') ? message?.slice(0, 200) : message?.slice(0, 3);
      console.log('cbWrap', err && err.toString(), messageSlice, last);
    }
    /* insert_features_recursive() "passes" last === undefined,
     * and when !err, message is datasetId (i.e. datasetName)
     */
    if (last || (last === undefined) || err) {
      if (cbCalled++ === 0) {
        if (err && (errors.length || warnings.length)) {
          err = [err.toString()].concat(errors).concat(warnings).join("\n");
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
  /** In the Docker container, server cwd is /.  scriptName (e.g. uploadSpreadsheet.bash) is in $scriptsDir/
   * backend/ has been renamed to lb4app, but eventually lb3app/ should be
   * re-absorbed and could become backend/ again.
   */
  scriptsDir = process.env.scriptsDir ||
    ((currentDir === "/") ? "/app/lb3app/scripts" :
     currentDir.endsWith("/lb4app") ? 'lb3app/scripts' : 
     currentDir.endsWith("/backend") ? 'scripts' : 'backend/scripts'),
  env = Object.assign({}, process.env),
  // process.execPath is /usr/bin/node,  need /usr/bin/ for mv, mkdir, perl
  PATH = process.env.PATH + ':' + scriptsDir,
  /** file handles : stdin, stdout, stderr, output errors, output warnings. */
  options = {env,  stdio: ['pipe', 'pipe', process.stderr, 'pipe', 'pipe'] };
  env.PATH = PATH;
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

  /** output chunks received from child, if progressive. */
  let outputs = [];
  let progressiveResult = undefined;
  function outCb(chunk) {
    if (progressiveResult) {
      // a further chunk received after finished(), so close child.
      console.log('outCb', 'SIGINT child', progressiveResult.length);
      child.kill('SIGINT');
    } else if (progressive) {
      let results;
      progressiveResult ||= (results = dataOutCb(chunk, cb));
      if (results) {
        const text = Buffer.concat(results).toString();
        cb(null, text);
      }
    }
    else {
      outputs.push(chunk);
    }
  }
  child.stdout.on('data', outCb);

  // since these are streams, you can pipe them elsewhere
  // child.stderr.pipe(dest);
  child.on('close', (code) => {
    console.log('child process exited with code',  code);
    if (! progressive && outputs.length) {
      let combined = Buffer.concat(outputs);
      dataOutCb(combined, cb);
    }
    if (code) {
      const error = Error("Failed processing file '" + fileName + "'.");
      cb(error);
    } else if (errors.length || warnings.length) {
      let
      errors_warnings = errors.concat(warnings).join("\n");
      errors = []; warnings = [];
      cb(new ErrorStatus(400, errors_warnings));
    } else {
      // process each tmp/out_json/"$datasetName".json
      const message = 'Processed file ' + fileName;
      if (child.killed) {
        cb(null, message, true);
      } else { //  return empty data result
        dataOutCb(null, cb);
        /* it would be equivalent to do : cb(null, [], true);
         * dataOutCb() may have completion actions.
         */
      }
    }
  });

  return child;
};

/*----------------------------------------------------------------------------*/

/* 
 * childProcess() was factored out of Dataset.upload() in models/dataset.js
 * The following is the remainder which was not used in childProcess(),
 * i.e. not common, and can replace the use of spawn() there.
 */

/* dataset upload */
function factored(msg, options, cb) {
  exports.childProcess('uploadSpreadsheet.bash', msg.data, true, msg.fileName, dataOutUpload, cb, /*progressive*/ false);
}

// msg file param from API request  {fileName, data, replaceDataset}

// params needed : this (model/dataset), models, options (optionsFromRequest), replaceDataset, uploadParsedTry
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
        this.removeExisting(models, /*options*/undefined, datasetName, replaceDataset, cb, loadAfterDelete);
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

/*----------------------------------------------------------------------------*/

/** Count occurrences of stringSearch in string.
 *
 * from : https://stackoverflow.com/a/10671743/18307804, method 3, Lorenz Lo Sauer.
 * https://stackoverflow.com/a/51493288/18307804 : Damion Dooley reports this is the fastest on Node.js v.6, of those methods.
 */
function stringCountString(string, stringSearch) {
  for (
    var count=-1, index=-2;
    index != -1;
    count++, index=string.indexOf(stringSearch, index+1)
  );
  return count;
}

// -----------------------------------------------------------------------------


const { ErrorStatus } = require('./errorStatus.js');

/** @return a callback wrapping the param cb
 * The signature of the result is function(chunk, cb), which matches param
 * dataOutCb of above childProcess().
 * @param cb
 * @param nLines if defined, limit the output to nLines.
 * (currently the whole of the last chunk containing line nLines is delivered).
 * If !progressive then nLines is not effective because dataOutCb receives the
 * combined chunks after child close.
 */
exports.dataOutReplyClosureLimit = function dataOutReplyClosureLimit(cb, nLines) {
  let chunks = [];
  let lineCount = 0;

  /* possibly add req to params and reference chunks there :
     let chunksSymbol = Symbol.for('dataOutChunks');
     req[chunksSymbol] = chunks;
  */

  return dataOutReply;

  /** Receive the results from the child process.
   * @param chunk is a Buffer
   * null / undefined indicates child process closed with status 0 (OK) and sent no output in this chunk.
   * @param cb is cbWrap of cb passed to vcfGenotypeLookup().
   * @return truthy if finished - i.e. unsubscribe; caller should not call again.
   * No effect if ! progressive; see nLines.
   */
  function dataOutReply(chunk, cb) {
    const fnName = 'dataOutReply';
    /** based on searchDataOut() */

    /** result is chunks, if chunk makes finished() true.  */
    let result;
    function finished() { return (nLines !== undefined) && (lineCount >= nLines); }
    if (! chunk) {
      // child status 0 (OK) and no output, so return [].
      cb(null, Buffer.concat(chunks).toString());
    } else if (! finished()) {
      const text = chunk?.toString();
      // equiv : text?.startsWith('Error:')
      if (chunk && (chunk.length >= 6) && (chunk.asciiSlice(0,6) === 'Error:')) {
        cb(new ErrorStatus(400, text));
      } else {
        /* childProcess() wraps the given cb : cbWrap calls cbOrig just once.
         * Otherwise, chunks could be catenated here into chunks.
         */
        if (text && (nLines !== undefined)) {
          lineCount += stringCountString(text, '\n');
          console.log(fnName, 'lineCount', lineCount, text.length, chunks.length);
          chunks.push(chunk);
          if (finished()) {
            result = chunks;
          }
        } else {
          cb(null, text);
        }
      }
    }
    return result;
  };
};

/** call dataOutReplyClosureLimit() with nLines === undefined.
 */
exports.dataOutReplyClosure = function dataOutReplyClosure(cb) {
  return exports.dataOutReplyClosureLimit(cb, /*nLines*/undefined);
};

/** @return a dataOutCb for childProcess()
 * @param dataCb reduces the received data, and when called with text ===
 * undefined (when chunk === null) it sends the result via cb.
 */
exports.dataReduceClosure = function dataReduceClosure(dataCb) {

  return dataReduce;

  function dataReduce(chunk, cb) {
    const fnName = 'dataReduce';

    const chunksText = chunk?.toString();
    const result = dataCb(null, chunksText);
    if (result) {
      cb(null, result);
    }
    /* could return result instead of delivering via cb() (not implemented); */
    // return result;
  };
};

// -----------------------------------------------------------------------------
