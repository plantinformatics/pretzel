
import BrAPI from '@solgenomics/brapijs';
//'./build/BrAPI.js';
import fetch from 'fetch';

//------------------------------------------------------------------------------

/* global Headers */

//------------------------------------------------------------------------------


/* from https://brapi.org/get-started/3
 *  /serverinfo
 */
const testServerURL = 'https://test-server.brapi.org/brapi/v2';
const yambase = 'https://www.yambase.org/brapi/v1';
const germinateServerURL = 'https://germinate.germinate.plantinformatics.io/api';
const serverURL = germinateServerURL; // testServerURL;
const brapi_v = 'brapi/v2';
const serverURLBrAPI = germinateServerURL + '/' + brapi_v;

let germinateToken;
germinateToken = 'd1e47fd3-480f-4306-88e0-517072af44e5';

// let germinate = new Germinate(serverURL);

class Germinate {
  constructor(/*serverURL*/) {
    if (! germinateToken) {
      debugger;
    }
    if (germinateToken) {
      console.log('Germinate', serverURL, germinateToken, 'this', this);
      this.brapi_root = BrAPI(serverURLBrAPI, "v2.0", germinateToken);
    }
  }
  
}
export {Germinate};

Germinate.prototype.serverinfo = serverinfo;
function serverinfo() {
  this.brapi_root
    .serverinfo()
    .all(function(objects){
      console.log(objects);
    });
}

Germinate.prototype.fetchEndpoint = fetchEndpoint;
/** Use fetch() for an endpoint which is not BrAPI, i.e. is not in serverURLBrAPI.
 * @param endpoint e.g. 'marker/table'
 * @return result of fetch() - promise yielding response or error
 */
function fetchEndpoint(endpoint, method = 'GET') {
  const
  resultP =
    fetch(serverURL + '/' + endpoint, {
      credentials : "include",
      headers : new Headers({
        // 'User-Agent': ...,
        'Accept': '*/*',
        // 'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/json;charset=utf-8',
        'Authorization': 'Bearer ' + germinateToken,
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        'Cache-Control': 'max-age=0'
      }),
      referrer : 'http://localhost:4200/',
      method,
      'mode': 'cors',
    });
  return resultP;
}

Germinate.prototype.markers = markers;
function markers() {
  this.fetchEndpoint('marker/table', 'POST')
    .then(response => {
    console.log(response);
  });
}

Germinate.prototype.callsets = callsets;
function callsets(data) {
  this.brapi_root
    .data(data)
    .callsets()
    .all(function(genotype_objects){
      console.log(genotype_objects);
    });
}

Germinate.prototype.germplasm = germplasm;
function germplasm() {
  this.brapi_root
    .germplasm()
    .all(function(objects){
      console.log(objects);
    });
}

Germinate.prototype.samples = samples;
function samples(dataset) {
  const samplesP =
  this.fetchEndpoint(brapi_v + '/' + 'callsets/dataset' + '/' + dataset)
    .then(response => {
    console.log(response);
  });
  return samplesP;
}


Germinate.prototype.callsetsCalls = callsetsCalls;
/* @param dataset, start, end
 * e.g. '1-593', '2932022', '2932028'
*/
function callsetsCalls(dataset, start, end) {
  this.fetchEndpoint(brapi_v + '/' + 'callsets'  + '/' + dataset + '/calls/' + start + '/' + end)
    .then(response => {
    console.log(response);
  });
}
