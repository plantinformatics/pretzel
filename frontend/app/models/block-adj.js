import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';
import { on } from '@ember/object/evented';

import { task, timeout, didCancel } from 'ember-concurrency';

const { inject: { service } } = Ember;

import { stacks, Stacked } from '../utils/stacks';
import { pathsResultTypeFor, featureGetFn, featureGetBlock } from '../utils/paths-api';
import { inRangeEither } from '../utils/draw/zoomPanCalcs';


const dLog = console.debug;
const trace_blockAdj = 0;

export default DS.Model.extend(Ember.Evented, {

  pathsPro : service('data/paths-progressive'),
  flowsService: service('data/flows-collate'),
  blocksService : service('data/block'),
  apiServers: service(),
  controls : service(),


  /** id is blockAdjId[0] + '_' + blockAdjId[1], as per.  serializers/block-adj.js : extractId()
   * and utils/draw/stacksAxes : blockAdjKeyFn()
   */

  block0: DS.belongsTo('block', { inverse: null }),
  block1: DS.belongsTo('block', { inverse: null }),
  blockId0: DS.attr('string'),
  blockId1: DS.attr('string'),
  // pathsResult : undefined,

  zoomCounter : 0,
  // range: attr(),

  blockAdjId : Ember.computed('blockId0', 'blockId1', function () {
    let
    blockAdjId = [this.get('blockId0'), this.get('blockId1')];
    return blockAdjId;
  }),

  /*--------------------------------------------------------------------------*/

  /** @return the block record handle if the block is loaded into the store from the backend.
   */
  peekBlock(blockId)
  {
    let
    block = this.get('blocksService').peekBlock(blockId);
    return block;
  },

  /*--------------------------------------------------------------------------*/

  /** @return true if this block is adjacent to the given block-adj
   */
  adjacentTo (block) {
    let blocks = this.get('blocks'),
    found = blocks.indexOf(block) > -1;
    if (! found) {
      /** also check referenceBlocks because clicking on axis selects the reference block */
      let referenceBlocks = this.get('referenceBlocks');
      found = referenceBlocks.indexOf(block) > -1;
      if (trace_blockAdj)
        dLog('adjacentTo', found, referenceBlocks, block);
    }
    return found;
  },

  /*--------------------------------------------------------------------------*/
  /* CFs based on axes could be moved to a component, e.g. draw/ stacks-view or block-adj */

  /** @return an array of block-s, for blockId-s in blockAdjId
   */
  blocks : Ember.computed('blockAdjId', function () {
    let
      blockAdjId = this.get('blockAdjId'),
    blocks = blockAdjId.map((blockId) => { return this.peekBlock(blockId); } );
    return blocks;
  }),
  referenceBlocks : Ember.computed.mapBy('blocks', 'referenceBlock'),
  /** Stacked Blocks - should be able to retire this. */
  sBlocks : Ember.computed('blockAdjId', function () {
    let
      blockAdjId = this.get('blockAdjId'),
    blocks = blockAdjId.map(function (blockId) { return stacks.blocks[blockId]; } );
    return blocks;
  }),
  /** Result is, for each blockID in blockAdjId,  the axis on which the block is displayed.
   * May need to add dependency on stacks component, because block can be un-viewed then re-viewed.
   */
  axes : Ember.computed('blocks', 'blocks.@each.axis', function () {
    let blocks = this.get('blocks'),
    axes = blocks.map(function (b) { return b.get('axis'); })
    /* When an axis is deleted, block.axis can become undefined before the
     * block-adj component is destroyed.  So handle axis === undefined. */
      .filter((b) => b);
    dLog('axes', blocks, axes);
    return axes;
  }),
  axes1d : Ember.computed('axes', 'axes.@each', function () {
    let axes = this.get('axes'),
    axes1d = axes.mapBy('axis1d');
    return axes1d;
  }),

  /** Return the zoomedDomain for each block of the block-adj, if they are
   * zoomed, undefined otherwise.
   *
   * This is useful because filtering can be skipped if ! zoomed, and the API
   * request also can omit the range filter if ! zoomed, so this might be used
   * also by intervalParams() (paths-progressive.js).
   *
   * Similar to following @see axesDomains()
   * @desc but that function determines the referenceBlock's domain if the block is not zoomed.
   */
  zoomedDomains :  Ember.computed.mapBy('axes1d', 'zoomedDomain'),
  /** domain incorporates zoomedDomain and also flipped and blocksDomain */
  domains :  Ember.computed.mapBy('axes1d', 'domain'),

  /** Return the domains (i.e. zoom scope) of the 2 axes of this block-adj.
   * These are equivalent : 
   * * this.get('axes').mapBy('domain')
   * * this.get('axes1d'), then either .mapBy('axisS.domain') or .mapBy('axis.view.axis.domain')
   */
  axesDomains : Ember.computed('axes1d', 'axes1d.@each.domain', 'axes', function () {
    let axes1d = this.get('axes1d')
    /* axes1d may contain undefined while an axis is being removed; the
     * block-adj will also be removed, so that state is transitory. */
      .filter(v => v !== undefined),
    axesDomains = axes1d.mapBy('domain');
    dLog('axesDomains', axesDomains, axes1d);
    /* if .currentPosition.yDomain has not yet been set, then use the range of
     * the reference block of the axis.  The latter is the complete domain,
     * whereas the former is a subset - the zoom scope. */
    let axes = this.get('axes');
    axesDomains = axesDomains.map(function (ad, i) {
      if (ad === undefined) {
        let axis = axes[i];
        // handle update
        if (! axis.blocks.length) {
          let newAxis = axes1d[i].axis.view.axis;
          dLog('axesDomains', axis, newAxis);
          axis = newAxis;
        }
        let rb = axis.referenceBlockS();
        if (rb) {
          ad = rb.block.get('range');
          dLog('axesDomains(): use range of referenceBlockS', i, rb, ad);
        }
      }
      return ad;
    });
    return axesDomains;
  }),
  /** Result is, for each blockID in blockAdjId,  the interval params of the axis on which the block is displayed.
   * @see axes()
   * @see axesDomains()
   */
  axisDimensions :  Ember.computed('axes', 'zoomCounter', function () {
    let 
      axes = this.get('axes'),
      intervals =
      axes.map(function (axis, i) {
        /** axes() needs to be recalculated after a block is adopted;
         * can depend on axes[*].axis1d.axisStackChanged ...
         */
        if (axis.stack.axes[0] !== axis) {
          axis = Stacked.getAxis(axis.axisName);
          if (! axis) {
            dLog('axisDimensions getAxis', axes[i]);
          }
        }
      return axis.axisDimensions();
      });
    return intervals;
  }),

  /** Result is true if the domains of the axes of this blockAdj have changed
   * since intervalParams was noted.
   */
  domainChange :  Ember.computed('axisDimensions', 'intervalParams', function () {
      let intervals = this.get('intervalParams'),
    /** interim measure to include pathsDensityParams in comparison; planning to
     * restructure using CP. */
    pathsDensityParams = this.get('pathsPro.pathsDensityParams'),
    fullDensity = this.get('pathsPro.fullDensity'),
    /** this can now be simplified to use axesDomains(). */
    intervalsAxes = this.get('axisDimensions'),
      domainsDiffer = function ()
      {
        let
        domainChanges = [0, 1].map(function (i) {
          /**
           * @param field name of parameter / field within pathsDensityParams and intervals.
           * @return true if the given field name  current value pathsDensityParams differs from the cached value intervals
           */
          function ppDiff(field) { 
            if (trace_blockAdj)
              dLog('ppDiff', field, pathsDensityParams[field], intervals[field]);
            return pathsDensityParams[field] && (pathsDensityParams[field] !== intervals[field]); }
          let d = intervals.axes[i].domain,
          d2 = intervalsAxes[i].domain,
          /** u === 1 means one domain is defined and the other is not, i.e. change is true.
           * Only evaluate d[] and d2[] if both domains are defined, i.e. u === 2. */
          u = (d === undefined) + (d2 === undefined),
          change = (u === 1) ||
            ((u === 0) && ((d[0] !== d2[0]) || (d[1] !== d2[1]))) ||
            ppDiff('nSamples') || ppDiff('nFeatures') || ppDiff('densityFactor')
          ;
          return change;
        });
        let change = domainChanges[0] || domainChanges[1];
        if (trace_blockAdj)
          dLog('domainChange', intervals, intervalsAxes, domainChanges, change);
        return change;
      },
      domainChange = fullDensity || ! intervals || domainsDiffer();
    return domainChange;
  }),



  pathsRequest : Ember.computed('pathsRequestCount', function () {
    let pathsRequestCount = this.get('pathsRequestCount');

    let blockAdjId = this.get('blockAdjId'),
      id2Server = this.get('apiServers.id2Server'),
    servers = blockAdjId.map((blockId) => id2Server[blockId]),
    sameServer = servers[0] === servers[1],
    pathJoinRemote = this.get('controls.view.pathJoinRemote');
    // uncomment these 2 conditions after testing on dev.
    // if (trace_blockAdj)
      dLog('pathsRequestCount', pathsRequestCount, blockAdjId, servers.mapBy('host'), sameServer, pathJoinRemote);
    let p;
    if (! pathJoinRemote && ! sameServer) {
      // if (trace_blockAdj)
        dLog('pathsRequest() different servers');
      p = Ember.RSVP.resolve([]); // will replace the promise return anyway.
    }
    else {
      p = this.call_taskGetPaths();
    }

    return p;
  }),
  pathsRequestLength : Ember.computed('pathsRequest', 'pathsRequestCount', function () {
    let pathsRequest = this.get('pathsRequest');
    let r = this.flowsAllSettled(pathsRequest);
    return r;
  }),
  flowsAllSettled(pathsRequest) {
    let r = [];
    if (pathsRequest.direct)
      r.push(pathsRequest.direct);
    if (pathsRequest.alias)
      r.push(pathsRequest.alias);
    r = Ember.RSVP.allSettled(r);
    return r;
  },

  lastPerformed : Ember.computed.alias('taskGetPaths._scheduler.lastPerformed'),
  lastResult : Ember.computed('lastPerformed', 'currentResult.direct.[]', 'currentResult.alias.[]', function () {
    let
      result = this.get('lastPerformed');
    if (result && (result = result.value))
    {
      const fieldNames = ['direct', 'alias'];
      result = result.reduce((r, v, i) => {
        if ((v.state == "fulfilled") && (v = v.value) && v.length)
          r[fieldNames[i]] = v;
        return r;
      }, {});
      dLog('lastResult', result);
      if (! Object.keys(result).length)
        result = undefined;
    }
    if (! result)
    {
      result = this.get('currentResult');
    }
    return result;
  }),
  currentResult : Ember.computed('pathsResult.[]', 'pathsAliasesResult.[]', function () {
    let result = {}, p;
    if ((p = this.get('pathsResult')))
      result.direct = p;
    if ((p = this.get('pathsAliasesResult')))
      result.alias = p;
    return result;
  }),
  /** @return a Map from a block of the block-adj to its position in blockAdjId.  */
  blockIndex : Ember.computed('blocks', function () {
    let blocks = this.get('blocks'),
    blockIndex = blocks.reduce(function (index, block, i) {
      index.set(block, i);
      return index;
    }, new Map());
    return blockIndex;
  }),
  filterPathsResult(pathsResultTypeName) {
    let paths, pathsFiltered;
    let blocksById = this.get('blocksService.blocksById');
    if ((paths = this.get(pathsResultTypeName))) {
      let pathsResultType = pathsResultTypeFor(pathsResultTypeName, paths && paths[0]);
      let 
      blockIndex = this.get('blockIndex'),
      /** blocks[] is parallel to zoomedDomains[]. */
      blocks = this.get('blocks'),
      /** just a check, will use block.get('zoomedDomain') in filter. */
      zoomedDomains = this.get('zoomedDomains');

      function filterOut(resultElt, i) {
        /** based on filterPaths: filterOut() in paths-table */
        let
          blockId = pathsResultType.pathBlock(resultElt, i),
        /** each end may have multiple features.
         * Here any features outside of the zoomedDomain of the feature's
         * block's axis are filtered out (or will be in a later version), and later the cross-product is
         * generated from the remainder.  If all features of one end are
         * filtered out then the resultElt is filtered out.
         */
        features = pathsResultType.blocksFeatures(resultElt, i),
        /** currently only handles paths with 1 feature at each end; i.e. it
         * will filter out the whole resultElt if feature[0] is out of range.
         * To filter out just some features of a resultElt, will need to copy the resultElt and .features[].
         */
        feature = features[0],
        featureGet = featureGetFn(feature), 
        block = featureGetBlock(feature, blocksById),
        index = blockIndex.get(block),
        zoomedDomain = zoomedDomains[index],
        value = featureGet('value'),
        out = zoomedDomain && ! inRangeEither(value, zoomedDomain);
        return out;
      }

      pathsFiltered = paths.filter(function (resultElt, i) {
        let include;
            let out = filterOut(resultElt, 0) || filterOut(resultElt, 1);
        return ! out;
      });
      dLog('filterPathsResult', pathsFiltered.length, pathsResultTypeName, zoomedDomains);
    }
    return pathsFiltered;
  },
  pathsResultFiltered : Ember.computed('blocks', 'pathsResult.[]', 'zoomedDomains.@each.{0,1}', function () {
    let
    pathsFiltered = this.filterPathsResult('pathsResult');
    return pathsFiltered;
  }),
  pathsAliasesResultFiltered : Ember.computed('pathsAliasesResult.[]', 'zoomedDomains.@each.{0,1}', function () {
    let
    pathsFiltered = this.filterPathsResult('pathsAliasesResult');
    return pathsFiltered;
  }),

  /**
   * Depending on zoomCounter is just a stand-in for depending on the domain of each block,
   * which is part of changing the axes (Stacked) to Ember components, and the dependent keys can be e.g. block0.axis.domain.
   * @return .lastResult()
   * //  previous result :  promises of paths array from direct and/or aliases, in a hash {direct : promise, alias: promise}
   */
  paths : Ember.computed('blockId0', 'blockId1', 'domains.{0,1}.{0,1}', /*'lastResult',*/ function () {
    /** This adds a level of indirection between zoomCounter and
     * pathsRequestCount, flattening out the nesting of run-loop calls.
     */
    this.incrementProperty('pathsRequestCount');
    let result = this.get('lastResult');
     // result = this.call_taskGetPaths();
    dLog('paths', result, this.get('domains'));

    // caller expects a hash of promises
    if (result) {
      let rp = Object.keys(result).reduce((r, fieldName) => {
        r[fieldName] = Ember.RSVP.resolve(result[fieldName]);
        return r;
      }, {});
    }

    return result;
  }),
  /** Setup params for calling taskGetPaths(). */
  call_taskGetPaths() {
    let blockAdjId = this.get('blockAdjId'),
    id = this.get('id');
    if (blockAdjId[0] === undefined)
      blockAdjId = this.id.split('_');

    let
      result,
    task = this.get('taskGetPaths');

    // expected .drop() to handle this, but get "TaskInstance 'taskGetPaths' was cancelled because it belongs to a 'drop' Task that was already running. "
    if (false && ! task.get('isIdle')) {
      dLog('paths taskGetPaths', task.numRunning, task.numQueued, blockAdjId);
      // result = this.get('lastResult');
      if (task.numRunning > 1) {
        result = task.get('lastPerformed');
        return result;
      }
    }

    if (trace_blockAdj)
      dLog('task.perform');
    /* In some cases this gets : TaskInstance 'taskGetPaths' was canceled because it belongs to a 'restartable' Task that was .perform()ed again.
     * Adding these has not solved that:
     * .catch() here and finally() in task( )
     * requestAliases: promise.catch
     * auth.js : getPaths{,Aliases}ViaStream() : promise.catch(interruptStream )
     */
    result = task.perform(blockAdjId)
      .catch((error) => {
        // arguments are 2 (direct & alias) of : {state: "fulfilled", value: [] }
        // Recognise if the given task error is a TaskCancelation.
        if (! didCancel(error)) {
          dLog('call_taskGetPaths taskInstance.catch', blockAdjId, error);
          throw error; }
        let lastResult = task.get('lastSuccessful.value');
        dLog('call_taskGetPaths', 'using lastSuccessful.value', lastResult, 
             task.get('state'), task.numRunning, task.numQueued
            );
        return lastResult;
      });

    return result;
  },

  /** Depending on flows.{direct,alias}.visible, call getPathsProgressive() and
   * getPathsAliasesProgressive().
   * Those functions may make a request to the backend server if a current result is not in hand,
   * so this function is wrapped by taskGetPaths().
   * @param taskInstance  TaskInstance which is performing this call.
   * Used to signal when to close EventSource.
   * @return promise of paths by direct and/or alias connections.
   */
  getPaths : function (blockAdjId, taskInstance) {
    let
      result = {},
    id = this.get('id');
    let flowsService = this.get('flowsService'),
    flows = flowsService.get('flows');

    let me = this;
    /** if ! trace_blockAdj then just trace .length. */
    let trace_suffix = trace_blockAdj ? '' : '.length';

    if (flows.direct.visible) {
      let
        paths = this.get('pathsPro').getPathsProgressive(this, blockAdjId, taskInstance);
      paths.then(
        function (result) {
          dLog('block-adj paths', result && result.length, me.get('pathsResult' + trace_suffix), id, me);
        }, function (err) {
          dLog('block-adj paths reject', err);
        }
      );
      result.direct = paths;
    }

    if (flows.alias.visible) {
      let
        pathsAliases = this.get('pathsPro').getPathsAliasesProgressive(this, blockAdjId, taskInstance);
      pathsAliases.then(
        function (result) {
          dLog('block-adj pathsAliases', result && result.length, me.get('pathsAliasesResult' + trace_suffix), id, me);
        }, function (err) {
          dLog('block-adj pathsResult reject', err);
        }
      );
      result.alias = pathsAliases;
    }

    return result;
  },

  /** Wrap getPaths() in a task, with .restartable() (was .drop) to debounce requests to backend server.
   * @return promise of paths by either direct or alias connections.
   * In the case of streaming results, the promise result is [], resolved after the end of the stream.
   * @see getPaths()
   */
  taskGetPaths : task(function* (blockAdjId) {
    let result;
    try {

      let 
        lastPerformed = this.get('lastPerformed');
      result =
        yield this.getPaths(blockAdjId, lastPerformed);
      result = yield this.flowsAllSettled(result);
      dLog('taskGetPaths result', result);

    }
    finally {
      if (! result) {
        dLog('taskGetPaths cancelled');
        let 
          lastPerformed = this.get('lastPerformed');
        if (lastPerformed.error)
          dLog('taskGetPaths lastPerformed.error', lastPerformed.error);
      }
      /* close EventSource.
       * This is achieved by passing this taskInstance (lastPerformed) via
       * getPaths(), so that listenEvents() : closeSource() will be called.
       */
    }

    return result;
  }).keepLatest() // .drop() // maxConcurrency(2).restartable() // 

  /*--------------------------------------------------------------------------*/

});
