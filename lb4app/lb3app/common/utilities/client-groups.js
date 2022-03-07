/* global exports */
/* global require */

// -----------------------------------------------------------------------------

class ClientGroups {
  constructor () {
    this.clientGroups = null;
  }
};
exports.ClientGroups = ClientGroups;

/** [clientId] -> [groupId-s]
*/
var clientGroups = new ClientGroups();
exports.clientGroups = clientGroups;

// -----------------------------------------------------------------------------

/**
 * @param blockId string, just the local blockId not a remote reference
 */
ClientGroups.prototype.update = async function (ClientGroup) {
  let clientGroupsP = ClientGroup.aggregate({
    $group : { _id : "$clientId", groups: {$addToSet : "$groupId"}}});
  /** result e.g.
   * [ { "_id" : ObjectId("60db102e162b5e27516170a2"), "groups" : [ ObjectId("621444120d48ade08e6c06ee"), ObjectId("621453130d48ade08e6c06f0") ] }, ... ]
  */
  clientGroupsP.toArray()
    .then((cgs)  => {
      this.clientGroups = {};
      cgs.forEach((cg) => {
        let clientId = cg._id.toHexString();
        // .map((id) => id.toHexString())
        console.log('update', clientId, cg.groups);
        this.clientGroups[clientId] = cg.groups;
      });
    });
};

// -----------------------------------------------------------------------------
