import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';
import { on } from '@ember/object/evented';

import { task, timeout } from 'ember-concurrency';

const { inject: { service } } = Ember;

import { stacks, Stacked } from '../utils/stacks';


export default DS.Model.extend(Ember.Evented, {

  pathsPro : service('data/paths-progressive'),
  flowsService: service('data/flows-collate'),

  /** id is blockAdjId[0] + '_' + blockAdjId[1], as per.  serializers/block-adj.js : extractId()
   * and utils/draw/stacksAxes : blockAdjKeyFn()
   */

  block0: DS.belongsTo('block', { inverse: null }),
  block1: DS.belongsTo('block', { inverse: null }),
  blockId0: DS.attr('string'), // belongsTo('block'),
  blockId1: DS.attr('string'), // belongsTo('block'),
  pathsResult : DS.attr(),

  zoomCounter : 0,
  // range: attr(),

  blockAdjId : Ember.computed('blockId0', 'blockId1', function () {
    let
    blockAdjId = [this.get('blockId0'), this.get('blockId1')];
    return blockAdjId;
  }),

  /*--------------------------------------------------------------------------*/
  /* CFs based on axes could be moved to a component, e.g. draw/ stacks-view or block-adj */

  blocks : Ember.computed('blockAdjId', function () {
    let
      blockAdjId = this.get('blockAdjId'),
    blocks = blockAdjId.map(function (blockId) { return stacks.blocks[blockId]; } );
    return blocks;
  }),
  /** Result is, for each blockID in blockAdjId,  the axis on which the block is displayed.
   * May need to add dependency on stacks component, because block can be un-viewed then re-viewed.
   */
  axes : Ember.computed('blocks', 'blocks.@each.axislater', function () {
    let blocks = this.get('blocks'),
    axes = blocks.map(function (b) { return b.getAxis(); });
    console.log('axes', blocks, axes);
    return axes;
  }),
  axes1d : Ember.computed('axes', 'axes.@each', function () {
    let axes = this.get('axes'),
    axes1d = axes.mapBy('axis1d');
    return axes1d;
  }),
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
    console.log('axesDomains', axesDomains, axes1d);
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
          console.log('axesDomains', axis, newAxis);
          axis = newAxis;
        }
        let rb = axis.referenceBlockS();
        if (rb) {
          ad = rb.block.get('range');
          console.log('axesDomains(): use range of referenceBlockS', i, rb, ad);
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
            console.log('axisDimensions getAxis', axes[i]);
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
    /** this can now be simplified to use axesDomains(). */
    intervalsAxes = this.get('axisDimensions'),
      domainsDiffer = function ()
      {
        let
        domainChanges = [0, 1].map(function (i) {
          let d = intervals.axes[i].domain,
          d2 = intervalsAxes[i].domain,
          /** u === 1 means one domain is defined and the other is not, i.e. change is true.
           * Only evaluate d[] and d2[] if both domains are defined, i.e. u === 2. */
          u = (d === undefined) + (d2 === undefined),
          change = (u === 1) ||
            ((u === 0) && ((d[0] !== d2[0]) || (d[1] !== d2[1])));
          return change;
        });
        let change = domainChanges[0] || domainChanges[1];
        console.log('domainChange', intervals, intervalsAxes, domainChanges, change);
        return change;
      },
      domainChange = ! intervals || domainsDiffer();
    return domainChange;
  }),



  pathsRequest : Ember.computed('pathsRequestCount', function () {
    let pathsRequestCount = this.get('pathsRequestCount');

    let blockAdjId = this.get('blockAdjId');
    console.log('pathsRequestCount', pathsRequestCount, blockAdjId);
    let p = this.call_taskGetPaths();

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
      console.log('lastResult', result);
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
  /**
   * Depending on zoomCounter is just a stand-in for depending on the domain of each block,
   * which is part of changing the axes (Stacked) to Ember components, and the dependent keys can be e.g. block0.axis.domain.
   * @return .lastResult()
   * //  previous result :  promises of paths array from direct and/or aliases, in a hash {direct : promise, alias: promise}
   */
  paths : Ember.computed('blockId0', 'blockId1', 'zoomCounter', 'lastResult', function () {
    /** This adds a level of indirection between zoomCounter and
     * pathsRequestCount, flattening out the nesting of run-loop calls.
     */
    this.incrementProperty('pathsRequestCount');
    let result = this.get('lastResult');
     // result = this.call_taskGetPaths();

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
    if (! task.get('isIdle')) {
      console.log('paths taskGetPaths', task.numRunning, task.numQueued, blockAdjId);
      // result = this.get('lastResult');
    }

    console.log('task.perform');
    /* In some cases this gets : TaskInstance 'taskGetPaths' was canceled because it belongs to a 'restartable' Task that was .perform()ed again.
     * Adding these has not solved that:
     * .catch() here and finally() in task( )
     * requestAliases: promise.catch
     * auth.js : getPaths{,Aliases}ViaStream() : promise.catch(interruptStream )
     */
    result = task.perform(blockAdjId)
      .catch(function () {
        // arguments are 2 (direct & alias) of : {state: "fulfilled", value: [] }
        console.log('call_taskGetPaths taskInstance.catch', blockAdjId); });

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

    if (flows.direct.visible) {
      let
        // getPathsProgressive() expects an array of 2 (string) blockIds.
        paths = this.get('pathsPro').getPathsProgressive(this, blockAdjId, taskInstance);
      paths.then(
        function (result) {
          console.log('block-adj paths', result.length, me.get('pathsResult'), id, me);
        }, function (err) {
          console.log('block-adj paths reject', err);
        }
      );
      result.direct = paths;
    }

    if (flows.alias.visible) {
      let
        // getPathsProgressive() expects an array of 2 (string) blockIds.
        pathsAliases = this.get('pathsPro').getPathsAliasesProgressive(this, blockAdjId, taskInstance);
      pathsAliases.then(
        function (result) {
          console.log('block-adj pathsAliases', result && result.length, me.get('pathsAliasesResult'), id, me);
        }, function (err) {
          console.log('block-adj pathsResult reject', err);
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
        /** now and lastStarted are in milliseconds */
        now = Date.now(),
      lastStarted = this.get('lastStarted'),
      elapsed;

      if (lastStarted && ((elapsed = now - lastStarted) < 5000)) {
        console.log('taskGetPaths : elapsed', elapsed);

        let lastPerformed = this.get('lastPerformed');
        if (lastPerformed)
          return lastPerformed;
        if (false && lastPerformed) {
          lastPerformed.then(function () {
            console.log('taskGetPaths lastPerformed', this, arguments);
          });
          let val = yield lastPerformed;
          console.log('taskGetPaths lastPerformed yield', val);
          return val;
        }
      }
      let task = this.get('taskGetPaths');
      if (! task.get('isIdle')) {
        try {
          let timeoutResult = yield timeout(2000); // throttle
          console.log('taskGetPaths : timeoutResult', timeoutResult);
        }
        finally {
          console.log('taskGetPaths : finally', this, arguments);  
        }
      }

      this.set('lastStarted', now);
      let 
        lastPerformed = this.get('lastPerformed');
      console.log('taskGetPaths : lastStarted now', now, lastPerformed);
      if (lastPerformed.error)
        console.log('taskGetPaths lastPerformed.error', lastPerformed.error);
      result =
        yield this.getPaths(blockAdjId, lastPerformed);
      result = yield this.flowsAllSettled(result);
      console.log('taskGetPaths result', result);

    }
    finally {
      if (! result) {
        console.log('taskGetPaths cancelled');
        let 
          lastPerformed = this.get('lastPerformed');
        if (lastPerformed.error)
          console.log('taskGetPaths lastPerformed.error', lastPerformed.error);
      }
      /* close EventSource.
       * This is achieved by passing this taskInstance (lastPerformed) via
       * getPaths(), so that listenEvents() : closeSource() will be called.
       */
    }

    return result;
  }).maxConcurrency(2).restartable() // drop()


  /*--------------------------------------------------------------------------*/

});
