import Ember from 'ember';

const { inject: { service }, Service, isEmpty } = Ember;

import { isObject, cloneDeepWith, isUndefined } from 'lodash/lang';
import { omitBy, extendWith } from 'lodash/object';
import { after } from 'lodash/function';


/* global EventSource */

const trace_paths = 0;
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

const requestEndpointAttr = 'session.requestEndpoint';

export default Service.extend({
  session: service('session'),
  apiEndpoints : service(),

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
    data = {blockA, blockB},
    url = this._endpointURLToken(data, route) + 
      '&blockA=' + blockA +
      '&blockB=' + blockB + '&' +
      Ember.$.param({intervals : filteredIntervalParams});
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
    data = {blockIds},
    url = this._endpointURLToken(data, route) + 
      '&blockIds[]=' + blockIds[0] +
      '&blockIds[]=' + blockIds[1] + '&' +
      Ember.$.param({intervals : filteredIntervalParams});
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

  getBlockFeaturesCounts(block, interval, nBins, options) {
    if (trace_paths)
      dLog('services/auth getBlockFeaturesCounts', block, interval, nBins, options);
    return this._ajax('Blocks/blockFeaturesCounts', 'GET', {block, interval, nBins, options}, true);
  },

  getBlockFeaturesCount(blocks, options) {
    if (trace_paths)
      dLog('services/auth getBlockFeaturesCount', blocks, options);
    return this._ajax('Blocks/blockFeaturesCount', 'GET', {blocks, options}, true);
  },

  getBlockFeatureLimits(block, options) {
    if (trace_paths)
      dLog('services/auth getBlockFeatureLimits', block, options);
    return this._ajax('Blocks/blockFeatureLimits', 'GET', {block, options}, true);
  },

  getBlockFeaturesInterval(blocks, intervals, options) {
    if (trace_paths)
      dLog('services/auth getBlockFeaturesInterval', blocks, intervals, options);
    return this._ajax('Blocks/blockFeaturesInterval', 'GET', {blocks, intervals, options}, true);
  },

  /** 
   */
  featureSearch(featureNames, options) {
    if (trace_paths)
      dLog('services/auth featureSearch', featureNames, options);
    return this._ajax('Features/search', 'GET', {filter : featureNames, options}, true);
  },

  createDataset(name) {
    return this._ajax('Datasets', 'POST', JSON.stringify({name: name}), true)
  },

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
  _ajax(route, method, data, token, onProgress) {
    let endpoint = this._endpoint(data),
     url = this._endpointURL(endpoint, route);

    let config = {
      url,
      type: method,
      crossDomain: true,
      headers: {},
      contentType: 'application/json'
    }

    if (data) config.data = data

    console.log('_ajax', arguments, this);
    if (token === true) {
      let accessToken = this._accessToken(endpoint);
      config.headers.Authorization = accessToken
    } else if (Ember.typeOf(token) == 'string') {
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

    return Ember.$.ajax(config)
  },

  _accessToken(endpoint) {
    let
    accessToken = endpoint && endpoint.token;
    if (! accessToken)
    this.get('session').authorize('authorizer:application', (headerName, headerValue) => {
      accessToken = headerValue;
    });
    console.log('_accessToken', endpoint, accessToken);
    return accessToken
  },
  /** Determine which endpoint to send the request to.
   * @param data  params to the API; these guide the endpoint determination;
   * e.g. if the param is block: <blockId>, use the endpoint from which blockId was loaded.
   */
  _endpoint(data) {
    let requestEndpoint;
    if (data.endpoint === 'primary') {
      requestEndpoint = this.get('apiEndpoints.primaryEndpoint');
    } else {
      let
        blockId = data.block || (data.blocks && data.blocks[0]) || data.blockA || data.blockA,
      blockEndpoint = blockId && this.get('apiEndpoints.id2Endpoint')[blockId];
      requestEndpoint = blockEndpoint || this.get(requestEndpointAttr);
      dLog(blockId, 'blockEndpoint', blockEndpoint);
    }
    return requestEndpoint;
  },
  /** construct the URL / URI for the given endpoint and route.
   * @param requestEndpoint determined by @see _endpoint()
   * @param route path of the route, i.e the path after /api/
   */
  _endpointURL(requestEndpoint, route) {
  let
    apiHost =  requestEndpoint && requestEndpoint.host;
    let config = Ember.getOwner(this).resolveRegistration('config:environment')
    let endpoint = (apiHost || config.apiHost) + '/' + config.apiNamespace + '/' + route
    dLog('_endpoint', requestEndpoint, apiHost, endpoint, config);
    return endpoint
  },
  /** Same as _endpointURL() plus append '?access_token=' + access token.
   * So the following query params are separated with & instead of ?
   * Used in getPathsViaStream(), getPathsAliasesViaStream() to construct a URL
   * for listenEvents() ... EventSource().
   *
   * Some discussion of how to avoid putting access_token in the URL as a query-param :
   * https://stackoverflow.com/questions/28176933/http-authorization-header-in-eventsource-server-sent-events
   * https://github.com/whatwg/html/issues/2177#issuecomment-487194160
   */
  _endpointURLToken(data, route) {
    let endpoint = this._endpoint(data),
    url = this._endpointURL(endpoint, route) +
      '?access_token=' + this._accessToken(endpoint);
    return url;
  }


});
