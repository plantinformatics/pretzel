import {HttpErrors, RequestContext} from '@loopback/rest';
/* This should import from @types/mongodb : import { ObjectId } from 'mongodb'; 
 * but that is not succeeding at the moment :
 *   error TS7016: Could not find a declaration file for module 'mongodb'.
 *  (retry this with a later version, if any)
 * (from LLM) "Since the mongodb package includes its own TypeScript types, you
 * do not need @types/mongodb."  That seems to be supported by :
 * https://www.mongodb.com/docs/manual/reference/bson-types/#objectid
 *
 * @types/mongodb is now empty - it does not define types. 
 * From https://www.npmjs.com/package/@types/mongodb :
 * Author message: mongodb provides its own types. @types/mongodb is no longer needed.
 * This is a stub types definition for @types/mongodb (https://github.com/mongodb/node-mongodb-native).
 * mongodb provides its own type definitions, so you don't need @types/mongodb installed!
 *
 *  node_modules/bson/index.js :  ObjectId = require('./lib/bson/objectid'),
 *  node_modules/bson/lib/bson/objectid.js : module.exports.ObjectId = ObjectID;
 */
// import {ObjectID} from 'mongodb'
// import { ObjectId } from 'mongodb'; 
// const { ObjectID /*ObjectId*/ } = require('mongodb');
// const ObjectId = require('bson').ObjectID;
type ObjectId = any;

import {MongoDsDataSource} from '../datasources';
import {Block, Dataset} from '../models';
import {
  BlockRepository,
  ClientGroupRepository,
  DatasetRepository,
  GroupRepository,
} from '../repositories';

export type ObjectIdLike = {toString(): string};

export class AuthUtils {
  constructor(
    private ctx: RequestContext,
    private mongoDs: MongoDsDataSource,
    private blockRepository: BlockRepository,
    private datasetRepository: DatasetRepository,
    private clientGroupRepository: ClientGroupRepository,
    private groupRepository: GroupRepository,
  ) {}

  getAccessToken(): string | undefined {
    const req = this.ctx.request;
    const auth = req.headers.authorization ?? (req.headers as any).Authorization;
    if (typeof auth === 'string' && auth.length) {
      const trimmed = auth.trim();
      const lower = trimmed.toLowerCase();
      const bearerPrefix = 'bearer ';
      if (lower.startsWith(bearerPrefix)) {
        return trimmed.slice(bearerPrefix.length).trim();
      }
      return trimmed;
    }
    const queryToken = (req.query as any)?.access_token;
    if (typeof queryToken === 'string' && queryToken.length) {
      return queryToken;
    }
    return undefined;
  }

  async getClientIdFromToken(): Promise<string | undefined> {
    const token = this.getAccessToken();
    if (!token) return undefined;
    const connector = this.mongoDs.connector as any;
    const db = connector?.db ?? connector;
    if (!db?.collection) return undefined;
    const accessToken = await db.collection('AccessToken').findOne({_id: token});
    const userId = accessToken?.userId;
    if (!userId) return undefined;
    return userId.toString();
  }

  async getClientGroupIds(clientId: string): Promise<Set<string>> {
    const [clientGroups, ownedGroups] = await Promise.all([
      this.clientGroupRepository.find({where: {clientId}}),
      this.groupRepository.find({where: {clientId}}),
    ]);
    const ids = new Set<string>();
    clientGroups.forEach(cg => ids.add(cg.groupId?.toString()));
    ownedGroups.forEach(g => {
      if (g.id) ids.add(g.id.toString());
    });
    return ids;
  }

  async authorizeDatasetClientGroupsRead(dataset: Dataset, clientId?: string, groupIds?: Set<string>): Promise<void> {
    if (dataset.public) return;
    if (!clientId) {
      throw new HttpErrors.Unauthorized('Access token required for private datasets');
    }
    if (dataset.clientId && dataset.clientId.toString() === clientId) return;
    if (dataset.groupId) {
      const groups = groupIds ?? await this.getClientGroupIds(clientId);
      if (groups.has(dataset.groupId.toString())) return;
    }
    throw new HttpErrors.Forbidden('Not authorized for dataset access');
  }

  async authorizeDatasetRead(datasetId: string): Promise<void> {
    /** Copied from authorizeBlocksRead(), which calls
     * authorizeDatasetClientGroupsRead() for each block.dataset, so it separates out
     * these 2 for efficiency. */
    const dataset = await this.datasetRepository.findById(datasetId);
    const clientId = await this.getClientIdFromToken();
    const groupIds = clientId ? await this.getClientGroupIds(clientId) : undefined;
    await this.authorizeDatasetClientGroupsRead(dataset, clientId, groupIds);
  }

  async authorizeBlocksRead(blockIds: Array<string | ObjectIdLike>): Promise<void> {
    if (!blockIds.length) {
      throw new HttpErrors.BadRequest('blockIds must be provided for authorization');
    }
    const clientId = await this.getClientIdFromToken();
    const blocks = await this.blockRepository.find({where: {id: {inq: blockIds}}});
    /** .find( { where { inq }} ) converts the parameter blockIds from string
     * to ObjectId, so cast it and rename it to blockObjectIds.
     *
     * See also 5088dc9a which normalized blocks[].id to strings and added
     * blockIdSet (of strings) but forgot that blockIds had been modified so
     * Set<string> .has( ObjectId value ) didn't match.
     * That approach can be used if blocks[].id or blockIds may be strings,
     * which is currently not the case.
     */
    const blockObjectIds : ObjectId[] = blockIds as unknown as ObjectId[];
    const missing = blockObjectIds.filter(id => !blocks.find(b => id.equals(b.id as unknown as ObjectId)));
    if (missing.length) {
      throw new HttpErrors.NotFound(`Blocks not found: ${missing.join(', ')}`);
    }
    const groupIds = clientId ? await this.getClientGroupIds(clientId) : undefined;
    const datasetIds = [...new Set(blocks.map(b => b.datasetId).filter(Boolean))] as string[];
    for (const datasetId of datasetIds) {
      const dataset = await this.datasetRepository.findById(datasetId);
      await this.authorizeDatasetClientGroupsRead(dataset, clientId, groupIds);
    }
  }

  enforceScopedBlockAccess(): void {
    if (process.env.AUTHZ_ALLOW_UNSCOPED_BLOCKS === 'true') return;
    throw new HttpErrors.BadRequest('This endpoint requires block/dataset scope for authorization');
  }
}
