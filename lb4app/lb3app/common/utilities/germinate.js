/*----------------------------------------------------------------------------*/
/* Node.js globals */
/* global exports */
/* global require */
/* global process */
/*----------------------------------------------------------------------------*/

/* global Headers */

//------------------------------------------------------------------------------
/** The scope of this module is :
 * . connection to a Germinate server
 * . BrAPI requests are wrapped (currently)
 * . provide fetchEndpoint() for other requests
 *
 * Related ./germinate-genotype.js
 */
//------------------------------------------------------------------------------

const BrAPI = require('@solgenomics/brapijs');
//'./build/BrAPI.js';

//------------------------------------------------------------------------------

const isNodeJs = typeof process !== 'undefined';

var bent;
let env;
if (isNodeJs) {
  bent = require('bent');
  env = process.env;
}
// else
// import fetch from 'fetch';
// import ENV from '../../config/environment';  env = ENV;

const fetchEndpoint = isNodeJs ? fetchEndpoint_bent : fetchEndpoint_fetch;

//------------------------------------------------------------------------------


/* from https://brapi.org/get-started/3
 *  /serverinfo
 */
const testServerURL = 'https://test-server.brapi.org/brapi/v2';
const yambase = 'https://www.yambase.org/brapi/v1';
const
/** scheme + userinfo + host + port */
germinateServerDomain = 'https://germinate.germinate.plantinformatics.io',
germinateServerURL = germinateServerDomain + '/api';
const serverURL = germinateServerURL; // testServerURL;
const brapi_v = 'brapi/v2';
const serverURLBrAPI = germinateServerURL + '/' + brapi_v;

const germinateToken = isNodeJs && env.germinateToken;

//------------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

//------------------------------------------------------------------------------

// let germinate = new Germinate(serverURL);

class Germinate {
  constructor(/*serverURL*/) {
    this.init();
  }
}
exports.Germinate = Germinate;

Germinate.prototype.init = init;
/** If germinateToken is defined in the environment of the server,
 * initialise the brapi library root BrAPINode.
 */
function init() {
  const fnName = 'init';
  if (germinateToken) {
    this.setToken(germinateToken);
  }
}
Germinate.prototype.setToken = setToken;
function setToken(token) {
  this.token = token;
  this.initBrAPIRoot(token);
}
Germinate.prototype.connect = connect;
/** Use Germinate login 'api/token'
 * @return a promise which yields undefined
 */
function connect() {
  const fnName = 'connect';
  console.log('Germinate', serverURL, '$germinateToken', 'this', this);
  const
  p =
    this.login()
    .then(token => {
      console.log(fnName, token);
      token && this.setToken(token); });
  return p;
}
Germinate.prototype.connectedP = connectedP;
/** @return a promise which resolves if/when connected and authenticated.
 */
function connectedP() {
  let p;
  if (! this.token) {
    p = this.connect();
  } else {
    p = Promise.resolve();
  }
  return p;
}
Germinate.prototype.initBrAPIRoot = initBrAPIRoot;
function initBrAPIRoot(token) {
  console.log('Germinate', serverURL, token, 'this', this);
  this.brapi_root = BrAPI(serverURLBrAPI, "v2.0", token);
  /** it is possible to change token by creating a child BrAPINode, via 
   * this.brapi_root.server(address, version, auth_token),
   * so initBrAPIRoot() could be moved out of init().
   */
}

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
function fetchEndpoint_fetch(endpoint, method = 'GET', body = undefined) {
  const
  fnName = 'fetchEndpoint_fetch',
  token = this.token || 'null',
  headerObj = {
        // 'User-Agent': ...,
        'Accept': '*/*',  // application/json, text/plain, 
        // 'Accept-Language': 'en-US,en;q=0.5',
        'Content-Type': 'application/json;charset=utf-8', // text/plain
        'Authorization': 'Bearer ' + token,
/*
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-origin', // site
        'Cache-Control': 'max-age=0',
*/
  },
  /** referrer sets the referer header. refn https://en.wikipedia.org/wiki/HTTP_referer
   * https://developer.mozilla.org/en-US/docs/Web/API/fetch  */
  options = {
      credentials : "include",
      headers : /*new Headers(*/headerObj/*)*/,
      referrer : germinateServerDomain + '/', // 'http://localhost:4200/',
      method,
      'mode': 'cors',
    };
  if (body) {
    /** fetch() requires JSON.stringify(body), whereas
     * bent() does not require body to be a string - it will JSON.stringify().
     */
    options.body = JSON.stringify(body);
  }
  console.log(fnName, headerObj, body);
  const
  resultP =
    fetch(serverURL + '/' + endpoint, options);
  return resultP;
}
function fetchEndpoint_fetch_login(endpoint, method = 'GET', body = undefined) {
  const
  fnName = 'fetchEndpoint_fetch',
  /** for login, .token is undefined.  `this` is not defined. */
  token = /*this.token ||*/ 'null',

  resultP = fetch(germinateServerURL + '/token', {
    "credentials": "include",
    "headers": {
        "Accept": "application/json, text/plain, */*",
        // "Accept-Language": "en_GB",
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": "Bearer null",
      /*
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin"
        */
    },
    "referrer": germinateServerDomain + '/',
    body : JSON.stringify(body),
    "method": "POST",
    "mode": "cors"
  });

  return resultP;
}

/**
 * @param body bent() does not require body to be string - it will JSON.stringify().
 */
function fetchEndpoint_bent(endpoint, method = 'GET', body = undefined) {
  const fnName = 'fetchEndpoint_bent';
  console.log(fnName, 'send request', endpoint);
  const
  // maybe pass options {credentials, mode} to bent() ?
  getJSON = bent(serverURL, method, 'json'),
  token = this.token || 'null',
  headers = // {'Authorization' : this.accessToken};
    {
      // 'User-Agent': 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0',
      'Accept': '*/*',
      // 'Accept-Language': 'en-US,en;q=0.5',
      'Content-Type': 'application/json;charset=utf-8',
      'Authorization': 'Bearer ' + token,
/*
      'Sec-Fetch-Dest': 'empty',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
      'Cache-Control': 'max-age=0'
*/
    },
  // new Headers( headers )

  /** bent accepts body as obj or json. */
  promise = getJSON('/' + endpoint, body, headers);
  return promise;
}

Germinate.prototype.login = login;
function login() {
  let tokenP;
  const
  fnName = 'login',
  username = isNodeJs ? env.germinate_username : env.username,
  password = isNodeJs ? env.germinate_password : env.password;
  if (username && password) {
    const
    body = {username, password},
    method = 'POST',
    endpoint = 'token';

    if (this.token) {
      console.log(fnName, this.token);
      debugger;
    }
    tokenP =
      // fetchEndpoint_fetch_login(endpoint, method, body)
    this.fetchEndpoint(endpoint, method, body)
      .then(response => {
        dLog(fnName, response);
        /** fetch() response has .ok and .json() returns a promise.
         * bent()() response is the parsed data.
         */
        const objP = response.ok ? response?.json() : Promise.resolve(response);
        return objP;
      })
      .then(obj => {
        console.log(fnName, obj);
        return obj.token;
      })
      .catch(err => {
        console.log(fnName, err);
        return null;
      });
  } else {
    tokenP = Promise.resolve(undefined);
  }
  return tokenP;
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
  this.fetchEndpoint(brapi_v + '/' + 'callsets/dataset' + '/' + dataset);
  /*
    .then(response => {
    console.log(response);
  })*/
  return samplesP;
}

function isDefined(x) {
  return (x !== undefined) && (x !== null);
}

Germinate.prototype.callsetsCalls = callsetsCalls;
/* @param dataset, start, end
 * e.g. '1-593', '2932022', '2932028'
*/
function callsetsCalls(dataset, start, end) {
  const fnName = 'callsetsCalls';
  /** Optional location / position / variantName interval to filter SNPs */
  let intervalParams = '';
  if (isDefined(start)) {
    intervalParams = '/' + start;
    if (isDefined(end)) {
      intervalParams += '/' + end;
    }
  }
  const
  endpoint = brapi_v + '/' + 'callsets'  + '/' + dataset + '/calls' + intervalParams,
  callsP = this.fetchEndpoint(endpoint);
  if (trace) {
    console.log(fnName, {serverURL, endpoint});
  }

/*
    .then(response => {
    console.log(response);
  })
*/

  return callsP;
}
