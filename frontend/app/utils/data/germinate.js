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

//import BrAPI from '@solgenomics/brapijs';
function BrAPI() { console.log('BrAPI not imported'); }
//'./build/BrAPI.js';

//------------------------------------------------------------------------------

const isNodeJs = typeof process !== 'undefined';

var bent;
//var omit;
let env;
if (isNodeJs) {
  bent = require('bent');
  // omit = require('lodash/object');
  env = process.env;
}
// else
import fetch from 'fetch';
import ENV from '../../config/environment';  env = ENV.germinate;
// import { omit } from 'lodash/object';

/**
 * signature : (endpoint, method = 'GET', body = undefined) -> promise
 * @param this  Germinate
 * @see fetchEndpoint()
 */
const fetchEndpointFn = isNodeJs ? fetchEndpoint_bent : fetchEndpoint_fetch;

//------------------------------------------------------------------------------


/* from https://brapi.org/get-started/3
 *  /serverinfo
 */
const testServerURL = 'https://test-server.brapi.org/brapi/v2';
const yambase = 'https://www.yambase.org/brapi/v1';
let
/** scheme + userinfo + host + port */
germinateServerDomain = 'https://germinate.plantinformatics.io',
germinateServerURL = germinateServerDomain + '/api';
let serverURL = germinateServerURL; // testServerURL;
const brapi_v = 'brapi/v2';
let serverURLBrAPI = germinateServerURL + '/' + brapi_v;

const germinateToken = isNodeJs && env.germinateToken;

//------------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

/** If obj is defined and contains fieldName, copy it and replace fieldName value with value.length.
 * Similar : lodash omit(obj, [fieldName]));
 */
function obscureField(obj, fieldName) {
  if (obj && obj[fieldName]) {
    obj = Object.assign({}, obj);
    obj[fieldName] = obj[fieldName].length;
  }
  return obj;
}

//------------------------------------------------------------------------------

// let germinate = new Germinate(serverURL);

class Germinate {
  constructor(germinateServerDomain_) {
    this.init();

    germinateServerDomain = germinateServerDomain_;
    germinateServerURL = germinateServerDomain + '/api';
    serverURL = germinateServerURL;
    serverURLBrAPI = germinateServerURL + '/' + brapi_v;
  }
}
export {Germinate};

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
Germinate.prototype.setCredentials = setCredentials;
function setCredentials(username, password) {
  this.username = username;
  this.password = password;
}
Germinate.prototype.connect = connect;
/** Use Germinate login 'api/token'
 * @return a promise which yields undefined
 */
function connect() {
  const fnName = 'connect';
  console.log('Germinate', serverURL, '$germinateToken', 'this', obscureField(this, 'password'));
  const
  p =
    this.login()
    .then(token => {
      console.log(fnName, token);
      token && this.setToken(token);
      if (! token) { throw 'login failed'; }
    });
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
  console.log('Germinate', serverURL, token, 'this', obscureField(this, 'password'));
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

//------------------------------------------------------------------------------

Germinate.prototype.fetchEndpoint = fetchEndpoint;
/** Call bent() or fetch() for Node.js or browser respectively.
 * @param this  Germinate
 * @param endpoint
 * @param method = 'GET'
 * @param body = undefined
 * @return promise yielding body of API response
 */
function fetchEndpoint() {
  const
  fetchEndpointP = fetchEndpointFn.apply(this, arguments)
    .then(response => responseValueP(response));
  return fetchEndpointP;
}

/** Access the value from fetchEndpoint().
 * fetch() response has .ok and .json() returns a promise.
 * bent()() response is the parsed data.
 *
 * This is used in all cases of fetchEndpoint().
 */
function responseValueP(response) {
  const fnName = 'responseValueP';
  if (! response.ok || response.status !== 200) {
    dLog(fnName, response.ok, response.status);
  }
  const
  value =
    ! response.ok ? Promise.reject(response.status, fnName) :
    response?.json ? response.json() : Promise.resolve(response);
  return value;
}

//--------------------------------------


/** Use fetch() for an endpoint which is not BrAPI, i.e. is not in serverURLBrAPI.
 * @param this  Germinate
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
  console.log(fnName, headerObj, obscureField(body, 'password'));
  const
  resultP =
    fetch(serverURL + '/' + endpoint, options);
  return resultP;
}
function fetchEndpoint_fetch_login(endpoint, method = 'GET', body = undefined) {
  const
  fnName = 'fetchEndpoint_fetch_login',
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
 * @param this  Germinate
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
  promise = getJSON('/' + endpoint, body, headers)
    .catch(error => { console.log(fnName, error); throw error; });
  return promise;
}

//------------------------------------------------------------------------------

Germinate.prototype.login = login;
function login(username_, password_) {
  let tokenP;
  const
  fnName = 'login',
  username = username_ || this.username || (isNodeJs ? env.germinate_username : env.username),
  password = password_ || this.password || (isNodeJs ? env.germinate_password : env.password);
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

//------------------------------------------------------------------------------


Germinate.prototype.maps = maps;
/** Get the list of genotype datasets.
 */
function maps() {
  const
  promise = this.fetchEndpoint(brapi_v + '/maps');
  return promise;
}

Germinate.prototype.linkagegroups = linkagegroups;
/** Get the list of linkagegroups (e.g. chromosomes) of a map (i.e. dataset).
 */
function linkagegroups(mapDbId) {
  /** refn :
   * https://brapigenotyping21.docs.apiary.io/#/reference/genome-maps/get-maps-map-db-id-linkagegroups
   * /maps/{mapDbId}/linkagegroups
   */
  const
  promise = 
    this.fetchEndpoint(brapi_v + '/maps/' + mapDbId + '/linkagegroups');
  return promise;
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
/* filtering based on positions and chromosome:
 * GET
 * {domain}/api/brapi/v2/callsets/{callSetDbId}/calls/mapid/{mapid}/chromosome/{chromosome}/position/{positionStart}/{positionEnd}
 * example: {domain}/api/brapi/v2/callsets/4-1036/calls/mapid/4/chromosome/10/position/1/300
 *
 * @param dataset, start, end
 * e.g. '1-593', '2932022', '2932028'
*/
function callsetsCalls(dataset, linkageGroupName, start, end) {
  const fnName = 'callsetsCalls';
  /** Optional location / position / variantName interval to filter SNPs */
  let intervalParams = '';
  if (isDefined(linkageGroupName)) {
    intervalParams += '/chromosome/' + linkageGroupName;
  } 
  if (isDefined(start)) {
    intervalParams += '/position/' + start;
    if (isDefined(end)) {
      intervalParams += '/' + end;
    }
  }
  const
  [mapid, sampleId] = dataset.split('-'),
  endpoint = brapi_v + '/' + 'callsets'  + '/' + dataset + '/calls'
    + '/mapid/' + mapid + intervalParams,
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

//------------------------------------------------------------------------------
