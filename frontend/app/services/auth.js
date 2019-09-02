import Ember from 'ember';

const { inject: { service }, Service, isEmpty } = Ember;

import { isObject, cloneDeepWith, isUndefined } from 'lodash/lang';
import { omitBy, extendWith } from 'lodash/object';
import { after } from 'lodash/function';


/* global EventSource */

const trace_paths = 1;

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

export default Service.extend({
  session: service('session'),

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

  uploadData(data) {
    return this._ajax('Datasets/upload', 'POST', JSON.stringify(data), true)
  },

  tableUpload(data) {
    return this._ajax('Datasets/tableUpload', 'POST', JSON.stringify(data), true)
  },

  getBlocks() {
    return this._ajax('Datasets', 'GET', {'filter[include]': 'blocks'}, true)
  },

  getPaths(blockA, blockB, withDirect, options) {
    console.log('services/auth getPaths', blockA, blockB, withDirect, options);
    return this._ajax('Blocks/paths', 'GET', {blockA : blockA, blockB : blockB, withDirect, options : options}, true)
  },

  getPathsProgressive(blockA, blockB, intervals, options) {
    console.log('services/auth getPathsProgressive', blockA, blockB, intervals, options);
    return this._ajax('Blocks/pathsProgressive', 'GET', {blockA : blockA, blockB : blockB, intervals, options : options}, true);
  },

  /** 
   * @param options.dataEvent callback which receives the data parcel
   */
  getPathsViaStream(blockA, blockB, intervals, options) {

    const filteredIntervalParams = omitUndefined(intervals);
    let
      route= 'Blocks/pathsViaStream',
    url = this._endpoint(route) +
      '?access_token=' + this._accessToken() + 
      '&blockA=' + blockA +
      '&blockB=' + blockB + '&' +
      Ember.$.param({intervals : filteredIntervalParams});
    console.log(url, blockA, blockB, intervals, filteredIntervalParams, options);

    function interruptStream() {
      console.log('interruptStream', this, arguments);
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
    console.log('listenEvents', url, dataEvent === resolve, arguments);
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
        console.log("Connection was opened", e.type, e);
      }, false);
      source.addEventListener('close', function(e) {
        console.log("Connection was closed", e.type, e);
      }, false);
      function closeSource () {
        console.log('closePromise', url, source.readyState, source.readyState !== EventSource.CLOSED, arguments, this);
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
        console.log('listenEvents', e.type, e, this, ".readyState", this.readyState, state, stateName[state], e);
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
    console.log('services/auth getPathsAliasesProgressive', blockIds, intervals, options);
    return this._ajax('Blocks/pathsAliasesProgressive', 'GET', {blockIds, intervals, options}, true);
  },

  /** 
   * @param options.dataEvent callback which receives the data parcel
   */
  getPathsAliasesViaStream(blockIds, intervals, options) {

    const filteredIntervalParams = omitUndefined(intervals);
    let
      route= 'Blocks/pathsAliasesViaStream',
    url = this._endpoint(route) +
      '?access_token=' + this._accessToken() + 
      '&blockIds[]=' + blockIds[0] +
      '&blockIds[]=' + blockIds[1] + '&' +
      Ember.$.param({intervals : filteredIntervalParams});
    console.log(url, blockIds, intervals, filteredIntervalParams, options);

    let promise = new Promise((resolve, reject) => {
      this.listenEvents(url, options, resolve, reject);
    });
    function interruptStream() {
      console.log('interruptStream', this, arguments);
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
    console.log('services/auth getPathsByReference', blockA, blockB, reference, max_distance, options);
    return this._ajax('Blocks/pathsByReference', 'GET', {blockA : blockA, blockB : blockB, reference, max_distance, options : options}, true);
  },

  getBlockFeaturesCount(blocks, options) {
    console.log('services/auth getBlockFeaturesCount', blocks, options);
    return this._ajax('Blocks/blockFeaturesCount', 'GET', {blocks, options}, true);
  },

  getBlockFeaturesInterval(blocks, intervals, options) {
    console.log('services/auth getBlockFeaturesInterval', blocks, intervals, options);
    return this._ajax('Blocks/blockFeaturesInterval', 'GET', {blocks, intervals, options}, true);
  },

  /** 
   */
  featureSearch(featureNames, options) {
    console.log('services/auth featureSearch', featureNames, options);
    return this._ajax('Features/search', 'GET', {filter : featureNames, options}, true);
  },

  createDataset(name) {
    return this._ajax('Datasets', 'POST', JSON.stringify({name: name}), true)
  },

  checkError(data, mapper) {
    // console.log('checkError')
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

  _ajax(route, method, data, token) {
    let endpoint = this._endpoint(route) 

    let config = {
      url: endpoint,
      type: method,
      crossDomain: true,
      headers: {},
      contentType: 'application/json'
    }

    if (data) config.data = data

    if (token === true) {
      let accessToken = this._accessToken()
      config.headers.Authorization = accessToken
    } else if (Ember.typeOf(token) == 'string') {
      config.headers.Authorization = token
    }

    return Ember.$.ajax(config)
  },

  _accessToken() {
    let accessToken;
    this.get('session').authorize('authorizer:application', (headerName, headerValue) => {
      accessToken = headerValue;
    });
    return accessToken
  },
  _endpoint(route) {
    let config = Ember.getOwner(this).resolveRegistration('config:environment')
    let endpoint = config.apiHost + '/' + config.apiNamespace + '/' + route
    return endpoint
  }

});
