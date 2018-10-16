import Ember from 'ember';
import { inject as service } from '@ember/service';
import { breakPoint } from '../../utils/breakPoint';


const { Component } = Ember;

/*----------------------------------------------------------------------------*/


/** Convert punctuation, including whitespace, to _  */
function removePunctuation(text) {
  // a normal input will contain e.g. :/@\.
  return text && text.replace(/[^A-Za-z0-9]/g, '_');
};


/** ApiEndpoint (components/service/api-endpoint)
 *
 * It is expected that values for the fields .host and .name are passed as
 * attributes of the create() options.
 *
 * Fields :
 *  .host URL of API host
 *  .user email of user account on that host
 *  .token  after login on that host, this is the authorization token;
 *
 */
export default Ember.Object.extend({
  dataset: service('data/dataset'),
  apiEndpoints: service('api-endpoints'),


  init() {
    this._super(...arguments);
  },

  /**  sanitize user input */
  name : Ember.computed('host', function () {
    let host = this.get('host'),
    name = removePunctuation(this.host);
    console.log('ApiEndpoint', this.host, this.user, this.token);
    return name;
  }),

  /** Used by panel/api-endpoint-tab.hbs
   * for unique IDs of tab DOM elements.
   */
  tabId : Ember.computed('name',  function() {
    let name = this.get('name'),
    id = name && name.replace(/^https?_+/, '');
    console.log('tabId', id, this);
    return id;
  }),
  /** Return text which is displayed on the API endpoint selector tabs in the
   * data explorer.
   *
   * Trim the leading http:// or https://, referred to as the scheme or
   * protocol, off the given URL.
   * The remainder consists of the [userinfo@]host[:port]
   * (https://en.wikipedia.org/wiki/Uniform_Resource_Identifier#Definition)
   * and is referred to as the authority.
   *
   * Similar : @see tabId()
   */
  tabText : Ember.computed('host',  function() {
    /** .host is actually the URL, i.e. userinfo+host+port (and possibly a path
     * prefix), not including the sub-path for the route, and query params. */
    let host = this.get('host');
    return host && host.replace(/^https?:\/\//, '');
  }),

  /** value is an array of datasets, including blocks, returned from the api host. */
  datasetsBlocks : undefined,
  
  actions: {

  },


    /**
   *
   * @param endpoint
   */
  getDatasets : function (endpoint) {
    let datasetService = this.get('dataset');
    let taskGetList = datasetService.get('taskGetList');  // availableMaps
    let datasetsTask = taskGetList.perform(endpoint);
    let
      me = this,
    name = endpoint.get('name'),
    apiEndpoints = this.get('apiEndpoints'),
    /** verification */
    endpointSo = apiEndpoints.lookupEndpoint(name),
    datasetsBlocks = this.get('datasetsBlocks'),
    datasetsHandle = endpoint && endpoint.host && endpoint.get('name');
    console.log('getDatasets', name, endpointSo);
    if (endpointSo !== endpoint)
      breakPoint('getDatasets', endpointSo, endpoint);

    datasetsTask.then(function (blockValues) {
      console.log(datasetsHandle, 'datasetsTask then', blockValues);
      if (datasetsHandle)
      {
        /** change to : apiEndpoints can do .on() of .evented() on task  */
        let datasetsBlocks = apiEndpoints.get('datasetsBlocks');
        datasetsBlocks[datasetsHandle] = blockValues;
        endpoint.set("datasetsBlocks", blockValues);
        // me.sendAction('receivedDatasets', datasetsHandle, blockValues);
        // or via .evented() on task
        me.trigger('receivedDatasets', blockValues);
      }
    });

    console.log('getDatasets', this);
    return datasetsTask;
  }
  // wrap with a service, endpoints OK in parallel, just 1 'getDatasets' per endpoint at once.
  // .drop()



});

export { removePunctuation };
