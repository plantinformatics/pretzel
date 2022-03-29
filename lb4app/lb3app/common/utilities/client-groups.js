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
    whenModels(app, (ClientGroup) => this.update(ClientGroup));
  }
};

exports.clientGroups = new ClientGroups();

// -----------------------------------------------------------------------------

/** Call fn with models.ClientGroup when ClientGroup.aggregate is defined
 */
function whenModels(app, fn) {
  let 
  d, db, ds, ClientGroup,
  ok = (
    (d = /*models.ClientGroup.*/ app.datasources) &&
      // m = d.mongoDs.connector._models,
    (db = d.db) && db.connected && db.initialized &&
    (ds = d.db?.models?.ClientGroup?.getDataSource()) &&
    (ClientGroup = ds.connector?.collection('ClientGroup')) &&
    (ClientGroup.aggregate)
    );
  if (ok) {
    /** Alternative to polling is these event listeners; not working yet.  */
    db.on('error', function (err) {
      console.log('Error : Failed to connect to database');
    });

    // mongoose : open
    db.once('serverOpening', function () {
      console.log("Info : Connected to database");
    });
    /* Some additional time is required after ok.  5sec is sufficient.
     * otherwise : loopback-connector-mongodb/lib/mongodb.js:384
     * throw new Error(g.f('{{MongoDB}} connection is not established'));
     */
    setTimeout(() => fn(ClientGroup), 5000, 'ClientGroup update');

  } else {
    setTimeout(() => whenModels(app, fn), 1000, 'ClientGroup update');
  }
  return ok;
}


// -----------------------------------------------------------------------------

/**
 * @param blockId string, just the local blockId not a remote reference
 */
ClientGroups.prototype.update = async function (ClientGroup) {
  if (! ClientGroup?.aggregate) {
    console.log('update', ClientGroup);
    debugger;
    return;
  }
  let clientGroupsP = ClientGroup.aggregate([
    {$group : { _id : "$clientId", groups: {$addToSet : "$groupId"}}}]);
  /** result e.g.
   * [ { "_id" : ObjectId("60db102e162b5e27516170a2"), "groups" : [ ObjectId("621444120d48ade08e6c06ee"), ObjectId("621453130d48ade08e6c06f0") ] }, ... ]
  */
  clientGroupsP.toArray()
    .then((cgs)  => {
      this.clientGroups = {};
      cgs.forEach((cg) => {
        let clientId = cg._id.toHexString(),
            groupHex = cg.groups?.map((g) => g?.toHexString());
        // .map((id) => id.toHexString())
        console.log('update', clientId, groupHex);
        this.clientGroups[clientId] = groupHex; // cg.groups;
      });
    });
};

// -----------------------------------------------------------------------------
