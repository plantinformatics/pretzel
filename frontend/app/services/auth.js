import { assert } from '@ember/debug';
import { getOwner } from '@ember/application';
import $ from 'jquery';
import Service, { inject as service } from '@ember/service';
import { isEmpty, typeOf } from '@ember/utils';

import {
  isObject,
  cloneDeepWith,
  isUndefined
} from 'lodash/lang';
import { omitBy, extendWith } from 'lodash/object';
import { after } from 'lodash/function';


/* global EventSource */

const trace_paths = 0;
const trace = 1;
const dLog = console.debug;

/** This value is used in SSE packet event id to signify the end of the cursor in pathsViaStream. */
const SSE_EventID_EOF = '-1';

/*----------------------------------------------------------------------------*/

/** jQuery.param() will translate {k: undefined} to {k : ''}, so deep-copy the
 * interval parameters omitting the attributes with value === undefined.
 */
function omitUndefined(value) {
  return JSON.parse(JSON.stringify(value));
}

/*----------------------------------------------------------------------------*/

const requestServerAttr = 'session.requestServer';

export default Service.extend({
  session: service('session'),
  apiServers : service(),

  changePassword(data) {
    return this._ajax('Clients/change-password', 'POST', JSON.stringify(data), true)
  },

  resetPassword(data, token) {
    return this._ajax('Clients/reset-password', 'POST', JSON.stringify(data), token)
  },

  resetRequest(data) {
    console.log('resetRequest')
    return this._ajax('Clients/reset', 'POST', JSON.stringify(data), false)
  },

  signupRequest(data) {
    console.log('signupRequest')
    return this._ajax('Clients/', 'POST', JSON.stringify(data), false)
  },

  groups(server, own) {
    let verb = own ? 'own' : 'in';
    /** server API /own will implement this filter by default, but client can
     * define it until LB4 API has clientId from accessToken.
     * The LB3 API is /Groups/, and the LB4 is /groups/.
    let clientId = this.get('session.session.authenticated.clientId');
    let data = clientId ? {'filter[where]': {clientId}} : {};
    dLog('groups', own, clientId);
    + clientId + '/'
     */
    return this._ajax('Groups/' + verb, 'GET', /*data*/{server}, true);
  },

  addClientGroupEmail(groupId, clientEmail) {
    let data = {groupId, clientEmail};
    return this._ajax('ClientGroups/addEmail', 'POST', JSON.stringify(data), true);
  },

  runtimeConfig() {
    console.log('runtimeConfig');
    return this._ajax('Configurations/runtimeConfig', undefined, 'GET', true);
  },

  uploadData(data, onProgress) {
    return this._ajax('Datasets/upload', 'POST', JSON.stringify(data), true, onProgress);
  },

  tableUpload(data, onProgress) {
    return this._ajax('Datasets/tableUpload', 'POST', JSON.stringify(data), true, onProgress);
  },

  getBlocks() {
    console.log('getBlocks');
    return this._ajax('Datasets', 'GET', {'filter[include]': 'blocks'}, true)
  },

  getPaths(blockA, blockB, withDirect, options) {
    if (trace_paths)
      dLog('services/auth getPaths', blockA, blockB, withDirect, options);
    return this._ajax('Blocks/paths', 'GET', {blockA : blockA, blockB : blockB, withDirect, options : options}, true)
  },

  getPathsProgressive(blockA, blockB, intervals, options) {
    if (trace_paths)
      dLog('services/auth getPathsProgressive', blockA, blockB, intervals, options);
    return this._ajax('Blocks/pathsProgressive', 'GET', {blockA : blockA, blockB : blockB, intervals, options : options}, true);
  },

  /** 
   * @param options.dataEvent callback which receives the data parcel
   */
  getPathsViaStream(blockA, blockB, intervals, options) {

    const filteredIntervalParams = omitUndefined(intervals);
    let
      route= 'Blocks/pathsViaStream',
    dataIn = {blockA, blockB},
    {url, data} = this._endpointURLToken(dataIn, route);
    data.intervals = filteredIntervalParams;
      url +=
      '&' +
      $.param(data);
    if (trace_paths)
      dLog(url, blockA, blockB, intervals, filteredIntervalParams, options);

    function interruptStream() {
      if (trace_paths)
        dLog('interruptStream', this, arguments);
    }
    let promise = new Promise((resolve, reject) => {
      this.listenEvents(url, options, resolve, reject);
    });
    promise.catch(interruptStream, 'handle Stream pre-emption by caller');

    return promise;
  },

  /** 
   * @param options {
   * dataEvent : function to call when data is received,
   * closePromise: close the source when this promise resolves }
   *
   * It would be a simpler API to return source instead of passing in
   * closePromise, but that would require splitting a couple of levels of
   * functions which currently return just a promise :
   * requestPathsProgressive(), auth.getPathsViaStream(),
   * auth.getPathsAliasesViaStream(), getPathsAliasesProgressive(),
   * requestAliases().
   */
  listenEvents(url, options, resolve, reject) {
    let
      dataEvent = options.dataEvent,
    closePromise = options.closePromise;
    if (trace_paths)
      dLog('listenEvents', url, dataEvent === resolve, arguments);
    /* from example : https://www.terlici.com/2015/12/04/realtime-node-expressjs-with-sse.html */
    if (!!window.EventSource) {
      var source = new EventSource(url, {withCredentials: true});

      function onMessage(e) {
        if (trace_paths > 2)
          console.log('onMessage', e, e.type, e.data, arguments);
        if (e.lastEventId === SSE_EventID_EOF) {
          // This is the end of the stream
          source.close();
          resolve([]);
        } else {
          let data = JSON.parse(e.data);
          if (! Array.isArray(data))
            data = [data];
          dataEvent(data);
        }
      };
      /* https://stackoverflow.com/a/42803814 :
       * "The onmessage handler assumes the event name is message. If you want to use other event names, you can subscribe to them using addEventListener." - Pappa.
       */
      source.addEventListener('pathsViaStream', onMessage, false);
      // source.onmessage = onMessage;

      source.addEventListener('open', function(e) {
        if (trace_paths)
          dLog("Connection was opened", e.type, e);
      }, false);
      source.addEventListener('close', function(e) {
        if (trace_paths)
          dLog("Connection was closed", e.type, e);
      }, false);
      function closeSource () {
        if (trace_paths)
          dLog('closePromise', url, source.readyState, source.readyState !== EventSource.CLOSED, arguments, this);
        // .close() does nothing if the connection is already closed, refn https://developer.mozilla.org/en-US/docs/Web/API/EventSource
        if (source.readyState !== EventSource.CLOSED)
          source.close();
      }
      // closePromise is a ember-concurrency TaskInstance, which defines .finally().
      // Could also closePromise.then(closeSource), but in that case the source has completed and would close normally.
      closePromise.finally(closeSource);
      function onError(e) {
        let state = e.eventPhase; // this.readyState seems constant.
        const stateName = ['CONNECTING', 'OPEN', 'CLOSED'];
        if (trace_paths)
          dLog('listenEvents', e.type, e, this, ".readyState", this.readyState, state, stateName[state], e);
        if (state === EventSource.CLOSED) {
          resolve([]);
        }
        else if (state == EventSource.CONNECTING) {
        }
        else
          reject(e);
      };
      source.onerror = onError; 
      // source.addEventListener('error', onError, false);
    }
  },

  getPathsAliasesProgressive(blockIds, intervals, options) {
    if (trace_paths)
      dLog('services/auth getPathsAliasesProgressive', blockIds, intervals, options);
    return this._ajax('Blocks/pathsAliasesProgressive', 'GET', {blockIds, intervals, options}, true);
  },

  /** 
   * @param options.dataEvent callback which receives the data parcel
   */
  getPathsAliasesViaStream(blockIds, intervals, options) {

    const filteredIntervalParams = omitUndefined(intervals);
    let
      route= 'Blocks/pathsAliasesViaStream',
    dataIn = {blockIds},
    {url, data} = this._endpointURLToken(dataIn, route);
    data.intervals = filteredIntervalParams;
    url +=
      '&' +
      $.param(data);
    if (trace_paths)
      dLog(url, blockIds, intervals, filteredIntervalParams, options);

    let promise = new Promise((resolve, reject) => {
      this.listenEvents(url, options, resolve, reject);
    });
    function interruptStream() {
      if (trace_paths)
        dLog('interruptStream', this, arguments);
    }
    promise.catch(interruptStream, 'handle Stream pre-emption by caller');

    return promise;
  },



  /** Send GET request Blocks/pathsByReference,
   * i.e. retrieve the paths connecting blockA and blockB via the reference assembly,
   * allowing up to max_distance physical distance (base pairs) between the features in the reference.
   * @param blockA	type:string,	required: true
   * @param blockB	type:string,	required: true
   * @param reference	type:string,	required: true  genome assembly
   * @param max_distance	type:number,	required: true
   * @param options	type:object,	http: optionsFromRequest
   */
  getPathsByReference(blockA, blockB, reference, max_distance, options) {
    if (trace_paths)
      dLog('services/auth getPathsByReference', blockA, blockB, reference, max_distance, options);
    return this._ajax('Blocks/pathsByReference', 'GET', {blockA : blockA, blockB : blockB, reference, max_distance, options : options}, true);
  },

  getBlockFeaturesCounts(block, interval, nBins, isZoomed, useBucketAuto, options) {
    if (trace_paths)
      dLog('services/auth getBlockFeaturesCounts', block, interval, nBins, isZoomed, useBucketAuto, options);
    return this._ajax('Blocks/blockFeaturesCounts', 'GET', {id : block, block, interval, nBins, isZoomed, useBucketAuto, options}, true);
  },

  getBlockFeaturesCount(blocks, options) {
    if (trace_paths)
      dLog('services/auth getBlockFeaturesCount', blocks, options);
    return this._ajax('Blocks/blockFeaturesCount', 'GET', {blocks, options}, true);
  },

  getBlockFeatureLimits(block, options) {
    if (trace_paths)
      dLog('services/auth getBlockFeatureLimits', block, options);
    return this._ajax('Blocks/blockFeatureLimits', 'GET', {id : block, block, options}, true);
  },

  getBlockValues(fieldName, options) {
    if (trace)
      dLog('services/auth getBlockValues', fieldName, options);
    return this._ajax('Blocks/blockValues', 'GET', {fieldName, options}, true);
  },

  getBlockFeaturesInterval(blockId, intervals, options) {
    if (trace_paths)
      dLog('services/auth getBlockFeaturesInterval', blockId, intervals, options);
    return this._ajax('Blocks/blockFeaturesInterval', 'GET', {id : blockId, blockId, intervals, options}, true);
  },

  /** Search for Features matching the given list of Feature names in featureNames[].
   * If blockId is given, only search within that block.
   * @param blockId undefined or string DB ObjectId
   * @param featureNames  array of Feature name strings
   */
  featureSearch(apiServer, blockId, featureNames, options) {
    if (trace_paths)
      dLog('services/auth featureSearch', blockId, featureNames, options);
    return this._ajax('Features/search', 'GET', {server : apiServer, blockId, filter : featureNames, options}, true);
  },

  /** Search for Aliases matching the given list of Feature names in featureNames[],
   * and search for Features matching the Aliases or Feature names.
   * @param featureNames  array of Feature name strings
   */
  featureAliasSearch(apiServer, featureNames, options) {
    if (trace_paths)
      dLog('services/auth featureAliasSearch', featureNames, options);
    return this._ajax('Features/aliasSearch', 'GET', {server : apiServer, featureNames, options}, true);
  },


  /** Request DNA sequence lookup (Blast).
   * @param parent  datasetId of parent / reference of the blast db which is to be searched
   * @param region e.g. 'chr6A:607200000-607200000'
   * @param options not used yet, may be for streaming result
   */
  dnaSequenceLookup(apiServer, parent, region, options) {
    dLog('services/auth dnaSequenceLookup', parent, region, options);
    return this._ajax('Blocks/dnaSequenceLookup', 'GET', {server : apiServer, parent, region, options}, true);
  },


  /** Request DNA sequence search (Blast).
   * @param dnaSequence string "atgcn..."
   * @param parent  datasetId of parent / reference of the blast db which is to be searched
   * @param searchType 'blast'
   * @param resultRows  limit rows in result 
   * @param addDataset  true means add / upload result to db as a Dataset
   * @param datasetName if addDataset, this value is used to name the added dataset.
   * @param minLengthOfHit, minPercentIdentity, minPercentCoverage : minimum values to filter results
   * @param options not used yet, probably will be for streaming result
   */
  dnaSequenceSearch(
    apiServer, dnaSequence, parent, searchType, resultRows, addDataset, datasetName,
    minLengthOfHit, minPercentIdentity, minPercentCoverage,
    options
  ) {
    dLog('services/auth dnaSequenceSearch', dnaSequence.length, parent, searchType, resultRows, addDataset, datasetName, options);
    /** allow longer for blast search; the server timeout for blast
     * search is defined in backend/scripts/blastn_request.bash
     */
    if (options.timeout === undefined) {
      options.timeout = 2 * 60 * 1000;
    }
    /** Attach .server to JSON string, instead of using
     * requestServerAttr (.session.requestServer)
     * (this can be unwound after adding apiServer as param to ._ajax(),
     *  dropping the new String() ).
     */
    let data = {
      dnaSequence, parent, searchType, resultRows, addDataset, datasetName,
      minLengthOfHit, minPercentIdentity, minPercentCoverage,
      options},
        dataS = JSON.stringify(data); // new String();
    // dataS.server = apiServer;
    return this._ajax('Features/dnaSequenceSearch', 'POST', dataS, true);
  },

  createDataset(name) {
    return this._ajax('Datasets', 'POST', JSON.stringify({name: name}), true)
  },

  /*--------------------------------------------------------------------------*/

  /**
   * @param rootId  e.g. 'CO_321'
   */
  ontologyGetTree(server, rootId, options) {
    return this._ajax('Ontologies/getTree', 'GET', {server, rootId, options}, true);
  },

  /*--------------------------------------------------------------------------*/

  checkError(data, mapper) {
    // dLog('checkError')
    try {
      if (data.error && data.error[0]) {
        return data.error[0]
      } else if (data.error && data.error.code) {
        let code = data.error.code
        if (mapper[code]) return mapper[code]
        else return code
      } else {
        return false
      }
    } catch (error) {
      console.error(error)
      // may need more sophisticated handling here depending upon
      // type of error
      return error
    }
  },

  /** Customised ajax caller
   * token may be actual token string, or equal true to trigger token fetch
   * onProgress is a callback accepting (percentComplete, data_direction)
   */
  _ajax(route, method, dataIn, token, onProgress) {
    let {server, data} = this._server(dataIn),
     url = this._endpoint(server, route);

    let config = {
      url,
      type: method,
      crossDomain: true,
      headers: {},
      contentType: 'application/json'
    }

    if (data) config.data = data

    if (trace) {
      dLog('_ajax', arguments, (trace < 2) ? ',' : this);
    }
    if (token === true) {
      let accessToken = this._accessToken(server);
      config.headers.Authorization = accessToken
    } else if (typeOf(token) == 'string') {
      config.headers.Authorization = token
    }

    // If an onProgress function passed, add progress event listeners
    if (onProgress instanceof Function) {
      config.xhr = function() {
        var xhr = new window.XMLHttpRequest();
        //Upload progress
        xhr.upload.addEventListener(
          'progress',
          function(evt) {
            if (evt.lengthComputable) {
              var percentComplete = (evt.loaded / evt.total) * 100;
              onProgress(percentComplete, 'up');
            }
          },
          false,
        );
        //Download progress
        xhr.addEventListener(
          'progress',
          function(evt) {
            if (evt.lengthComputable) {
              var percentComplete = (evt.loaded / evt.total) * 100;
              onProgress(percentComplete, 'down');
            }
          },
          false,
        );
        return xhr;
      };
    }

    return $.ajax(config);
  },

  _accessToken(server) {
    let
    accessToken = server && server.token;
    if (! accessToken) {
      let session = this.get('session');
      accessToken = this.get('session.data.authenticated.token');
      dLog('_accessToken', this.get('session'), accessToken, server);
    }
    if (trace) {
      dLog('_accessToken', (trace < 2) ? ',' : server, accessToken);
    }
    return accessToken
  },
  /** Determine which server to send the request to.
   * @param data  params to the API; these guide the server determination;
   * e.g. if the param is block: <blockId>, use the server from which blockId was loaded.
   *
   * For POST, data is a JSON string, so data.server is not defined (except by dnaSequenceSearch);
   * this is handled by the 'if (! requestServer) {' case.
   * This will be simplified by adding apiServer as an (optional)
   * param to _ajax(), _server(), _endpointURLToken().
   *
   * @desc
   * The compound result includes a copy of these params, modified to suit the
   * server which is chosen : paths request params may be remote references, and
   * are converted to local if they are being sent to the server they refer to.
   * @return {server <ApiServer>, data}
   * The blockIds in input param data may be modified, in which case result
   * .data is a modified copy of input data.
   */
  _server(data) {
    let result = {data}, requestServer;
    if (data.server) {
      if (data.server === 'primary')
        requestServer = this.get('apiServers.primaryServer');
      else {
        requestServer = data.server;
        delete data.server;
      }
    } else {
      /** Map a blockId which may be a remote reference, to a local blockId;
       * no change if the value is already local.
       * This function is copied from backend/common/utilities/localise-blocks.js
       */
      function blockLocalId(blockId) {
        return blockId.blockId || blockId;
      }
      const
      /** @param blockId may be local or remote reference. */
      blockIdServer = (blockId) => this.get('apiServers.id2Server')[blockLocalId(blockId)];

      /** recognise the various names for blockId params.
       * lookup the servers for the given blockIds.
       * if the servers are different :
       *  If one of the blockId/s is from primaryServer then use primaryServer,
       *  otherswise choose the first one.
       */
      let
        blockIds = data.blocks || data.blockIds ||
        [data.blockA, data.blockB].filter((b) => b),
      blockServers = blockIds && blockIds.map((blockId) => blockIdServer(blockId)),
      blockId = data.block,
      blockServer = blockId && blockIdServer(blockId);
      if (blockServer) {
        if (blockServers.length) {
          dLog('_server', 'data has both single and multiple block params - unexpected', 
               data, blockIds, blockServers, blockId, blockServer);
        }
        requestServer = blockServer;
      } else if (blockServers.length === 1) {
        requestServer = blockServers[0];
      } else if (blockServers.length) {
        let primaryServer = this.get('apiServers.primaryServer');

        if (blockServers[0] === blockServers[1]) {
          requestServer = blockServers[0];
          // requestServer owns both the input blockId params, so convert them both to local.
          result.data = blockIdMap(data, [blockLocalId, blockLocalId]);
        } else if (blockServers.indexOf(primaryServer) >= 0)
          requestServer = primaryServer;
        else {
          requestServer = blockServers[0];
          if (blockServers.length > 1)
            result.data = blockIdMap(data, [blockLocalId, I]);
        }
      }
      if (! requestServer) {
	/** For requests without blockIds to determine blockServer from.
	 * requestServerAttr (.session.requestServer) is set by buildURL(),
	 * called via adapters/application.js: updateRecord().  Prior to that
	 * being called, fall back to primaryServer, e.g. for runtimeConfig
	 * which is used by getHoTLicenseKey() when the key is not defined in
	 * the build environment.
	 */
        requestServer = this.get(requestServerAttr)
	  || this.get('apiServers.primaryServer');
      }
      dLog(blockId, 'blockServer', blockServer, requestServer, this.get(requestServerAttr));
    }
    result.server = requestServer;
    return result;
  },
  /** construct the URL / URI for the given server and route.
   * @param requestServer determined by @see _server()
   * @param route path of the route, i.e the path after /api/
   */
  _endpoint(requestServer, route) {
  let
    apiHost =  requestServer && requestServer.host;
    let config = getOwner(this).resolveRegistration('config:environment')
    let endpoint = (apiHost || config.apiHost) + '/' + config.apiNamespace + '/' + route
    /** Pretzel is designed to support multiple servers sub-domains for
     * different species (e.g. *.plantinformatics.io) and they have separate
     * logins, so the authentication cookie token is not shared between
     * subdomains which is the default configuration of ember-simple-auth.
     * Not setting .cookieDomain prevents interference from cookies from
     * other subdomains and the parent domain.  Secondary servers have
     * separate login and authentication.
     * refn: https://ember-simple-auth.com/api/classes/CookieStore.html
     *  "If not explicitly set, the cookie domain defaults to the domain the
     *  session was authenticated on."
     */
    if (trace) {
      dLog('_endpoint', apiHost, endpoint, trace > 1 && [requestServer, config]);
    }
    return endpoint
  },
  /** Same as _endpoint() plus append '?access_token=' + access token.
   * So the following query params are separated with & instead of ?
   * Used in getPathsViaStream(), getPathsAliasesViaStream() to construct a URL
   * for listenEvents() ... EventSource().
   *
   * Some discussion of how to avoid putting access_token in the URL as a query-param :
   * https://stackoverflow.com/questions/28176933/http-authorization-header-in-eventsource-server-sent-events
   * https://github.com/whatwg/html/issues/2177#issuecomment-487194160
   */
  _endpointURLToken(dataIn, route) {
    let {server, data} = this._server(dataIn),
    url = this._endpoint(server, route) +
      '?access_token=' + this._accessToken(server);
    return {url, data};
  }


});

/*----------------------------------------------------------------------------*/

/** Map the input blockId params of data, using mapFns, which contains a
 * function for the first and second blockId params respectively.
 */
function blockIdMap(data, mapFns) {
  /** blockA, blockB, blockIds are the input blockId params;
   * d is the result data, and at this point contains the other params.
   */
  let 
    // the version of Babel in use is giving SyntaxError: Unexpected token
    // {blockA, blockB, blockIds, ...d} = data,
    // so manually spread the object :
    blockA = data.blockA,
  blockB = data.blockB, 
  blockIds = data.blockIds || data.blocks,
  arrayName = (data.blockIds && 'blockIds') || (data.blocks && 'blocks'),
  restFields = Object.keys(data).filter(
    (f) => ['blockA', 'blockB', 'blockIds', 'blocks'].indexOf(f) === -1),
  d = restFields.reduce((result, f) => {result[f] = data[f]; return result;}, {}),
  /** ab is true if data contains .blockA,B, false if .blockIds or .blocks */
  ab = !!blockA;
  console.log('blockIdMap', data, blockA, blockB, blockIds, restFields, d, ab);
  if ((!blockA !== !blockB) || (!blockA === !blockIds)) {
    assert('param data is expected to contain either .blockA and .blockB, or .blockIds : ' +
                 JSON.stringify(data), false);
  }
  /* if data has .blockA,B, put those params into blockIds[] to be processed in
   * the same way that .blockIds[] is, then move the results back to .blockA,B
   *
   * This would read better if the .map was factored into a function and called
   * separately for .blockA,B and .blockIds - can do that after commit (already
   * tested as is).
   */
  if (ab) {
    blockIds = [blockA, blockB];
  }
  /** if blockIds.length > mapFns.length, then mapFns[0] === mapFns[1], so just use mapFns[0]. */
  blockIds = blockIds.map((blockId, i) => (mapFns[i] || mapFns[0])(blockId));
  if (ab)
    [d.blockA, d.blockB] = blockIds;
  else {
    d[arrayName] = blockIds;
  }
  console.log('blockIdMap', d, ab, arrayName);
  return d;
}

function I(x) { return x; }

/*----------------------------------------------------------------------------*/


