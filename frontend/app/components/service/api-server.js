import EmberObject, { computed } from '@ember/object';
import Component from '@ember/component';
import { getOwner, setOwner } from '@ember/application';
import { inject as service } from '@ember/service';
import { task, timeout, didCancel } from 'ember-concurrency';

import { breakPoint } from '../../utils/breakPoint';
import DataGroups from '../../utils/data/groups';



/* global d3 */

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

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

//------------------------------------------------------------------------------

export { serverTypeIsGerminateAPI };
/** Map serverTypeName to a flag indicating if the server API is like Germinate / BrAPI;
 * i.e. this includes the Spark server.
 * @param serverTypeName 'Pretzel', 'Germinate', 'Spark'
 */
function serverTypeIsGerminateAPI(serverTypeName) {
  return ['Germinate', 'Spark'].includes(serverTypeName);
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
const ApiServerAttributes = {
  dataset: service('data/dataset'),
  block: service('data/block'),
  apiServers: service(),
  queryParamsService: service('query-params'),
  auth : service(),


  init() {
    this._super(...arguments);

    let groups = DataGroups.create({server : this});
    setOwner(groups, getOwner(this));
    this.set('groups', groups);
  },
  willDestroy() {
    this.get('groups').destroy();
    this.set('groups', null);

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
  /** results from services/data/block.js : blockFeatureValues() : blockFeature{Trait,Ontology}{P,} */

  actions: {

  },

  /*--------------------------------------------------------------------------*/

  get blockFeatureTraits() {
    return this.get('block').blockFeatureValues(this, 'Trait');
  },
  get blockFeatureOntologies() {
    return this.get('block').blockFeatureValues(this, 'Ontology');
  },

  /*--------------------------------------------------------------------------*/

  /** Get API Version of server;  request it if not already done.
   * @return promise yielding apiVersion
   */
  getVersion : function () {
    const
    fnName = 'getVersion',
    server = this; // this.get('apiServers').lookupServerName(this.get('name'));
    /** could use a task with .drop().  */
    if (! server.getVersionP) {
      server.getVersionP = this.get('auth').getVersion(server)
        .then((configVersion) => {
          dLog(fnName, configVersion);
          server.apiVersion = configVersion.apiVersion;
          return server.apiVersion;
        })
        .catch((error) => {
          dLog(fnName, error);
          if (error.statusCode === 404) {
            server.apiVersion = 1;
          }
          return server.apiVersion;
        });
    }
    return server.getVersionP;
  },

  /** Get the list of datasets, including their blocks, from this API server.
   *
   */
  getDatasets : function () {
    const fnName = 'getDatasets';
    let datasetService = this.get('dataset');
    let taskGetList = datasetService.get('taskGetList');  // availableMaps
    /** server was a param when this function was an attribute of apiServers. */
    let server = this;
    server.groups.refresh();
    /** filter is no longer available as store.adapterOptions in
     * adapters/application.js : headers(), so obj2Server cannot be
     * used, so pass server reference here; this will be cleared when
     * used.
     */
    this.apiServers.set('currentRequestServer', this);
    this.apiServers.set('currentRequestServerTime', Date.now());
    let datasetsTask = taskGetList.perform(server)
        .catch((error) => {
          // Recognise if the given task error is a TaskCancelation.
          if (! didCancel(error)) {
            dLog(fnName, ' taskInstance.catch', this.name, error);
            throw error;
          }
        });

    let
    name = server.get('name'),
    apiServers = this.get('apiServers'),
    /** verification
     * This could use lookupServerName(), because server.name has already been
     * processed with removePunctuation().
     */
    serverSo = apiServers.lookupServer(name),
    datasetsBlocks = this.get('datasetsBlocks'),
    datasetsHandle = server && server.host && server.get('name');
    console.log('getDatasets', name, serverSo);
    if (serverSo !== server)
      breakPoint('getDatasets', serverSo, server);

    datasetsTask = 
    datasetsTask.then((blockValues) => {
      console.log(datasetsHandle, 'datasetsTask then', blockValues);
      if (datasetsHandle)
      {
        /** change to : apiServers can do .on() of .evented() on task  */
        let datasetsBlocks = apiServers.get('datasetsBlocks');
        /** if TaskCancelation, no result, so don't replace previous result.
         * If request failed because of e.g. comms, don't want to repeat so accept the undefined result.
         * Can look at separating these 2 cases.
         */
        let blockValuesCurrent;
        if ((! blockValues || ! blockValues.length) &&
            ((blockValuesCurrent = datasetsBlocks[datasetsHandle]) && blockValuesCurrent.length)) {
          dLog(fnName, 'TaskCancelation datasetsTask.then', blockValues, blockValuesCurrent.length);
        } else {
        datasetsBlocks[datasetsHandle] = blockValues;
        server.set("datasetsBlocks", blockValues);
        apiServers.incrementProperty('datasetsBlocksRefresh');
        // (where me = apiServers)
        // me.sendAction('receivedDatasets', datasetsHandle, blockValues);
        // receivedDatasets : sendAction() is replaced by trigger().
        // alternative : via .evented() on task
        apiServers.trigger('receivedDatasets', blockValues);
        // mapview : model() has already done getBlocksLimits() for primaryServer
        if (this.get('apiServers.primaryServer') !== this) {
          let ti = this.get('featuresCountAllTaskInstance');
          dLog('getDatasets', 'evaluated featuresCountAllTaskInstance', ti);
        }
        }
      }
    });

    console.log('getDatasets', this);
    return datasetsTask;
  }
  // wrap in a task, requests to different servers OK in parallel, just 1 'getDatasets' per server at once.
  // .drop()

  ,

  /** From datasetsBlocks, filter out copies from a secondary server.
   */
  datasetsBlocksOriginal : computed('datasetsBlocks', function () {
    const
    dbOriginal = this.get('datasetsBlocks')
      ?.filter((dataset) => !dataset.get('isCopy'));
    return dbOriginal;
  }),

  /** Request block.featuresCount for all blocks.
   */
  featuresCountAllTaskInstance : computed('name', function () {
    dLog('featuresCountAllTaskInstance', this.name, this);
    let params = this.get('queryParamsService').get('params');
    // copied from routes/mapview.js:model()
    let allInitially = params.parsedOptions && params.parsedOptions.allInitially;
    const blockService = this.get('block');
    // (allInitially ? '' : 'Summary')
    let getBlocksTask = blockService.get('getBlocksLimits');

    /** Task Instance.  param blockIds is [] */
    let getBlocksTI = getBlocksTask.apply(blockService, [[]]);

    return getBlocksTI;
  }),

  blocksByReferenceAndScope : computed(
    'datasetsBlocks.[]',
    function() {
      let
      /** use .blocksOriginal, which filters out by .isCopy */
      blocks = this.datasetsBlocks && this.datasetsBlocks.flatMap((d) => d.blocksOriginal.map((b) => b)),
      map = ! blocks ? new Map() : this.get('block').mapBlocksByReferenceAndScope(blocks);
      return map;
    }),

  /** @return an object mapping from blockId to status of featuresCounts
   */
  blocksFeaturesCountsStatus : computed('datasetsBlocks', function () {
    const
    fnName = 'blocksFeaturesCountsStatus',
    /** [[blockId, status], ...] */
    blocksStatusP = this.get('block').getBlocksFeaturesCountsStatus(/*blockIds*/undefined, this),
    byBlockIdP = blocksStatusP.then(blocksStatus => blocksStatus.reduce((result, bs) => {
      result[bs[0]] = bs[1];
      return result;
    }, {}));
    // also attach result to block
    byBlockIdP.then(byBlockId => {
      this.blocksAnnotateWithFCStatus(byBlockId);
    });
    return byBlockIdP;
  }),
  blocksAnnotateWithFCStatus(byBlockId) {
    const
    fnName = 'blocksAnnotateWithFCStatus';
    dLog(fnName);
    this.datasetsBlocks.forEach(dataset => dataset.blocks.forEach(block => {
      block[Symbol.for('featuresCountsStatus')] = byBlockId[block.id];
    }));
  },


};
export default EmberObject.extend(ApiServerAttributes);

export { removePunctuation, ApiServerAttributes };
