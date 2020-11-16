import EmberObject, { computed } from '@ember/object';
import Component from '@ember/component';
import { inject as service } from '@ember/service';
import { breakPoint } from '../../utils/breakPoint';


/* global d3 */

/*----------------------------------------------------------------------------*/

/* d3.schemeDark2
*/
let apiServers_colour_scale =
  d3.scaleSequential().domain([0,4]).interpolator(d3.interpolateRainbow);
// or d3.scaleOrdinal().range(d3.schemeCategory10)


/*----------------------------------------------------------------------------*/


/** Convert punctuation, including whitespace, to _  */
function removePunctuation(text) {
  // a normal input will contain e.g. :/@\.
  return text && text.replace(/[^A-Za-z0-9]/g, '_');
}

/*----------------------------------------------------------------------------*/

/** ApiServer (components/service/api-server)
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
export default EmberObject.extend({
  dataset: service('data/dataset'),
  apiServers: service(),


  init() {
    this._super(...arguments);
  },

  /**  sanitize user input */
  name : computed('host', function () {
    let host = this.get('host'),
    name = removePunctuation(this.host);
    console.log('ApiServer', this.host, this.user, this.token);
    return name;
  }),

  /** Used by panel/api-server-tab.hbs
   * for unique IDs of tab DOM elements.
   */
  tabId : computed('name',  function() {
    let name = this.get('name'),
    id = name && name.replace(/^https?_+/, '');
    console.log('tabId', id, this);
    return id;
  }),
  /** Return text which is displayed on the API server selector tabs in the
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
  tabText : computed('host',  function() {
    /** .host is actually the URL, i.e. userinfo+host+port (and possibly a path
     * prefix), not including the sub-path for the route, and query params. */
    let host = this.get('host');
    return host && host.replace(/^https?:\/\//, '');
  }),

  /** A consistent colour is used to denote each api-server.
   * This is used as a border around the api-server tab in manage-explorer,
   * and for the circle beside the block in the axis title (axisTitleBlocksServers.js).
   */
  colour : computed('name', function () {
    /** .name is used as the store name (refn : api-servers.js : addServer() : {,un}registerStore())
     * So it is also possible to use e.g. block.store.name to lookup apiServers_colour_scale();
     * for scaleOrdinal this.get('name') is used directly;
     * for scaleSequential, .lookupServerNameIndex() is used to map that to an integer
     */
    let index = this.get('apiServers').lookupServerNameIndex(this.get('name'));
    return apiServers_colour_scale(index);
  }),



  /** value is an array of datasets, including blocks, returned from the api host. */
  datasetsBlocks : undefined,
  
  actions: {

  },


  /** Get the list of datasets, including their blocks, from this API server.
   *
   */
  getDatasets : function () {
    let datasetService = this.get('dataset');
    let taskGetList = datasetService.get('taskGetList');  // availableMaps
    /** server was a param when this function was an attribute of apiServers. */
    let server = this;
    let datasetsTask = taskGetList.perform(server);
    let
    name = server.get('name'),
    apiServers = this.get('apiServers'),
    /** verification */
    serverSo = apiServers.lookupServer(name),
    datasetsBlocks = this.get('datasetsBlocks'),
    datasetsHandle = server && server.host && server.get('name');
    console.log('getDatasets', name, serverSo);
    if (serverSo !== server)
      breakPoint('getDatasets', serverSo, server);

    datasetsTask.then(function (blockValues) {
      console.log(datasetsHandle, 'datasetsTask then', blockValues);
      if (datasetsHandle)
      {
        /** change to : apiServers can do .on() of .evented() on task  */
        let datasetsBlocks = apiServers.get('datasetsBlocks');
        datasetsBlocks[datasetsHandle] = blockValues;
        server.set("datasetsBlocks", blockValues);
        apiServers.incrementProperty('datasetsBlocksRefresh');
        // (where me = apiServers)
        // me.sendAction('receivedDatasets', datasetsHandle, blockValues);
        // or via .evented() on task
        apiServers.trigger('receivedDatasets', blockValues);
      }
    });

    console.log('getDatasets', this);
    return datasetsTask;
  }
  // wrap in a task, requests to different servers OK in parallel, just 1 'getDatasets' per server at once.
  // .drop()



});

export { removePunctuation };
