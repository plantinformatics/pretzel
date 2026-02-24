import {MongoDsDataSource} from '../datasources';

export class ClientGroups {
  /** All client-groups, in the format {clientId : [groupId, ...], ...}
   */
  clientGroups: Record<string, string[]> = {};
  /** All groups, in the form : {groupId : group record, ...} */
  groups: Record<string, any> = {};
  private dataSource?: MongoDsDataSource;

  init(dataSource: MongoDsDataSource): void {
    this.dataSource = dataSource;
    void this.update();
  }

  /** Called after an update action for collections Groups or ClientGroups.
   * Collate .groups[] and .clientGroups[]
   */
  async update(): Promise<void> {
    const fnName = 'update';
    const ds = this.dataSource;
    if (!ds?.connected) {
      console.log('update', 'waiting for connection' /*, ds, ds?.connected*/);
      return;
    }
    const connector: any = ds.connector;
    const db = connector?.db ?? connector;
    if (!db?.collection) return;

    const Group = db.collection('Group');
    const ClientGroup = db.collection('ClientGroup');

    /** originally just the ids : [{$project : {_id : 1}}] */
    const groups = await Group.aggregate().toArray();
    this.groups = groups.reduce(
      (result: Record<string, any>, group: any) => {
        result[group._id] = group;
        return result;
      },
      {},
    );
    console.log(fnName, 'Groups :', groups.length); console.dir(this.groups);
    const groupIdsHex = groups.map((group: any) => group._id?.toHexString?.() ?? String(group._id));
    await this.updateWithGroupIds(ClientGroup, groupIdsHex);
  }

  /**
   * @param ClientGroup	collection
   * @param groupIds [string]
   */
  async updateWithGroupIds(ClientGroup: any, groupIds: string[]): Promise<void> {
    const fnName = 'updateWithGroupIds';
    const clientGroupsP = ClientGroup.aggregate([
      {$group: {_id: '$clientId', groups: {$addToSet: '$groupId'}}},
    ]);
    /** result e.g.
     * [ { "_id" : ObjectId("60db102e162b5e27516170a2"), "groups" : [ ObjectId("621444120d48ade08e6c06ee"), ObjectId("621453130d48ade08e6c06f0") ] }, ... ]
     */
    const cgs = await clientGroupsP.toArray();
    this.clientGroups = {};
    cgs.forEach((cg: any) => {
      /** this would be caused by ClientGroup with {clientId : null}, which is invalid;  */
      if (!cg._id) {
        console.log(fnName, cg, JSON.stringify(cg));
        return;
      }
      const clientId = cg._id?.toHexString?.() ?? String(cg._id);
      const groupHexAll = cg.groups?.map((g: any) => g?.toHexString?.() ?? String(g));
      /** cg.groups ids in hex, filtered to those in groupIds[] */
      const groupHex = groupHexAll.reduce((result: string[], g: string) => {
        if (groupIds.includes(g)) {
          result.push(g);
        } else {
          console.log(fnName, clientId, g, 'not in ', groupIds);
        }
        return result;
      }, []);
      // .map((id) => id.toHexString())
      console.log(fnName, clientId, groupHex);
      this.clientGroups[clientId] = groupHex;
    });
  }
}

export const clientGroups = new ClientGroups();
