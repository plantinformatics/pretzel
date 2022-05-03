/* global exports */
/* global require */

// -----------------------------------------------------------------------------

class ClientGroups {
  constructor () {
    /** [clientId] -> [groupId-s]
     */
    this.clientGroups = null;
  }
  init(app) {
    whenModels(app, async (ClientGroup) => { await this.update(ClientGroup); console.log('after await update'); this.registerUpdate(app, ClientGroup); });

    /** These event listeners don't fire; app does define these event names :
     * app.eventNames()
     * (8) ['mount', 'modelRemoted', 'stateChanged', 'loaded', 'started', 'modelDeleted', 'remoteMethodAdded', 'remoteMethodDisabled']
     */
    if (app) {
      app.on('stateChanged', data => {
        console.log('stateChanged', data);
      });

      app.once('mount', function () {
        console.log('app.once(mount)', app);
      });

      app.once('loaded', function () {
        console.log('app.once(loaded)', app);
      });
      app.once('started', function () {
        console.log('app.once(started)', app);
      });

    }

  }
};

exports.clientGroups = new ClientGroups();

// -----------------------------------------------------------------------------

/** Call fn with models.ClientGroup when it is OK to call ClientGroup.aggregate.
 *
 * The purpose of this delay is to avoid this error :
 *   loopback-connector-mongodb/lib/mongodb.js:384
 *     if (!this.db) {
 *       throw new Error(g.f('{{MongoDB}} connection is not established'));
 */
function whenModels(app, fn) {
  /** After experimentation and reading the source (haven't found a doc covering this),
   * it seems that when topology is defined, it is OK to call ClientGroup.aggregate.
   * The function which throws the error, MongoDB.prototype.collection(),
   * specifically tests this.db which seems to be e.g. ClientGroup.s.db.
   * Polling until this value is defined has proven sufficient.
   *
   * None of the event listeners fired, apart from topology : 'connectionReady'
   * which fires after the .aggregate() call starts - perhaps a lazy connection.
   */
  let 
  d, db, ds, ClientGroup,
  c, t, updateStarted,
  ok = (
    (d = /*models.ClientGroup.*/ app.datasources) &&
      // m = d.mongoDs.connector._models,
    (db = d.db) && db.connected && db.initialized &&
    (ds = d.db?.models?.ClientGroup?.getDataSource()) &&
    (c = ds.connector) && 
    (t = c.client?.topology) &&
    (ClientGroup = ds.connector?.collection('ClientGroup')) &&
    (ClientGroup.aggregate)
    );
  console.log('whenModels', !!d, !!db, !!ds, !!c, !!t, !!ClientGroup?.db);
  if (ClientGroup?.s?.db) {
    updateStarted = true;
    fn(ClientGroup);
  }
  if (t) {
    console.log('ds', /*d, db, 'ds', ds*/);
    /** Alternative to polling is these event listeners; not working yet.
     * ds.eventNames()  []
     * db.eventNames()  []
     * c.client.eventNames()  ['newListener']
     */
    db.on('error', function (err) {
      console.log('Error : Failed to connect to database');
    });

    // mongoose : open
    db.once('connect', function () {
      console.log("Info : Connected to database");
    });

    /** t.eventNames() does include these event names; only connectionReady fires.
     * (35) ['authenticated', 'error', 'timeout', 'close', 'parseError', 'fullsetup', 'all', 'reconnect', 'commandStarted', 'commandSucceeded', 'commandFailed', 'serverOpening', 'serverClosed', 'serverDescriptionChanged', 'serverHeartbeatStarted', 'serverHeartbeatSucceeded', 'serverHeartbeatFailed', 'topologyOpening', 'topologyClosed', 'topologyDescriptionChanged', 'joined', 'left', 'ping', 'ha', 'connectionPoolCreated', 'connectionPoolClosed', 'connectionCreated', 'connectionReady', 'connectionClosed', 'connectionCheckOutStarted', 'connectionCheckOutFailed', 'connectionCheckedOut', 'connectionCheckedIn', 'connectionPoolCleared', 'open']
     */
    t.once('serverOpening', function () {
      console.log("Info : database : topology : serverOpening");
    });
    t.once('topologyOpening', function () {
      console.log("Info : database : topology : topologyOpening");
    });
    t.once('all', function (a, b, c) {
      console.log("Info : database : topology : all", a, b, c);
    });    
    t.once('connectionReady', function () {
      console.log("Info : database : topology : connectionReady", !!ClientGroup?.s?.db);
    });

    db.once('connected', function () {
      console.log("Info : database : connected");
    });
  }
  if (! updateStarted) {
    setTimeout(() => whenModels(app, fn), 1000, 'ClientGroup update');
  }
  return ok;
}

// -----------------------------------------------------------------------------

/** Register fn() to be called after eventName of model.
 * Used by registerUpdate().
 */
ClientGroups.prototype.registerUpdateSingle = function (eventName, modelName, model, fn) {
  model.observe('after ' + eventName, (ctx, next) => {
    const
    fnName = modelName + ':after ' + eventName,
    obj = ctx.where || ctx.instance,
    id = obj.id;
    console.log(fnName, '' + id);
    fn();
    next();
  });

};
/** Register .update() to be called after save or delete of ClientGroup or Group.
 */
ClientGroups.prototype.registerUpdate = function (app, ClientGroup) {
  /** Loopback model, !== ClientGroup param (Collection). */
  const lbClientGroup = app.models.ClientGroup;
  if (! lbClientGroup.observe) {
    console.log('registerUpdate', 'observe', lbClientGroup.observe, lbClientGroup);
    return;
  }
  if (this.isRegistered) { return; } else { this.isRegistered = true; }

  /** loopback Group */
  const lbGroup = app.models.Group;

  const fn = () => this.update(ClientGroup); 
  ['save', 'delete'].forEach((eventName) => {
    this.registerUpdateSingle(eventName, 'ClientGroup', lbClientGroup, fn);
    this.registerUpdateSingle(eventName, 'Group', lbGroup, fn);
  });

};

// -----------------------------------------------------------------------------

/**
 */
ClientGroups.prototype.update = async function (ClientGroup) {
  if (! ClientGroup?.aggregate) {
    console.log('update', ClientGroup);
    debugger;
    return;
  }
  const Group = ClientGroup.s.db.collection('Group');
  await
  Group.aggregate([{$project : {_id : 1}}])
    .toArray()
    .then((groupIds) => {
      let groupIdsHex = groupIds.map((proj) => proj._id.toHexString());
      this.updateWithGroupIds(ClientGroup, groupIdsHex); });
};

/**
 * @param groupIds [string]
 */
ClientGroups.prototype.updateWithGroupIds = async function (ClientGroup, groupIds) {
  const fnName = 'updateWithGroupIds';
  let clientGroupsP = ClientGroup.aggregate([
    {$group : { _id : "$clientId", groups: {$addToSet : "$groupId"}}}]);
  /** result e.g.
   * [ { "_id" : ObjectId("60db102e162b5e27516170a2"), "groups" : [ ObjectId("621444120d48ade08e6c06ee"), ObjectId("621453130d48ade08e6c06f0") ] }, ... ]
  */
  await
  clientGroupsP.toArray()
    .then((cgs)  => {
      this.clientGroups = {};
      cgs.forEach((cg) => {
        /** this would be caused by ClientGroup with {clientId : null}, which is invalid;  */
        if (! cg._id) {
          console.log(fnName, cg, JSON.stringify(cg));
          return;
        }
        let clientId = cg._id.toHexString(),
            groupHexAll = cg.groups?.map((g) => g?.toHexString()),
            groupHex = groupHexAll.reduce((result, g) => {
              if (groupIds.includes(g)) {
                result.push(g);
              } else {
                console.log(fnName, clientId, g, 'not in ', groupIds);
              }
              return result;
            }, []);

        // .map((id) => id.toHexString())
        console.log('update', clientId, groupHex);
        this.clientGroups[clientId] = groupHex; // cg.groups;
      });
    });
};

// -----------------------------------------------------------------------------
