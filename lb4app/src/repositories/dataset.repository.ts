import {inject, Getter} from '@loopback/core';
import {
  repository,
  HasManyRepositoryFactory,
  BelongsToAccessor,
  Options,
  Where,
  Count,
} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Dataset, DatasetRelations, Block} from '../models';
import {RecordBaseRepository} from './record.repository.base';
import {BlockRepository} from './block.repository';
import {GroupRepository} from './group.repository';
import {ClientRepository} from './client.repository';
// @ts-ignore
const {clientIsInGroup, clientOwnsGroup, groupIsWritable} = require('../../lb3app/common/utilities/identity');
// @ts-ignore
const {ErrorStatus} = require('../../lb3app/common/utilities/errorStatus');

export class DatasetRepository extends RecordBaseRepository<
  Dataset,
  typeof Dataset.prototype.name,
  DatasetRelations
> {

  public readonly blocks: HasManyRepositoryFactory<Block, typeof Dataset.prototype.name>;

  public readonly parentId: BelongsToAccessor<Dataset, typeof Dataset.prototype.name>;

  public readonly children: HasManyRepositoryFactory<Dataset, typeof Dataset.prototype.name>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
    @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>,
    @repository.getter('GroupRepository') protected groupRepositoryGetter: Getter<GroupRepository>,
    @repository.getter('DatasetRepository') protected datasetRepositoryGetter: Getter<DatasetRepository>,
    @repository.getter('ClientRepository') protected clientRepositoryGetter: Getter<ClientRepository>,
  ) {
    super(Dataset, dataSource, clientRepositoryGetter, groupRepositoryGetter);
    this.children = this.createHasManyRepositoryFactoryFor('children', datasetRepositoryGetter,);
    this.parentId = this.createBelongsToAccessorFor('parentId', datasetRepositoryGetter,);
    this.blocks = this.createHasManyRepositoryFactoryFor('blocks', blockRepositoryGetter,);
    this.registerInclusionResolver('blocks', this.blocks.inclusionResolver);
  }

  async create(entity: Partial<Dataset>, options?: Options): Promise<Dataset> {
    await this.beforeSave(entity, options, /*isNew*/ true);
    return super.create(entity, options);
  }

  async updateById(
    id: typeof Dataset.prototype.name,
    data: Partial<Dataset>,
    options?: Options,
  ): Promise<void> {
    const current = await this.findById(id);
    await this.beforeSave(data, options, /*isNew*/ false, current);
    await super.updateById(id, data, options);
  }

  async replaceById(
    id: typeof Dataset.prototype.name,
    data: Dataset,
    options?: Options,
  ): Promise<void> {
    const current = await this.findById(id);
    await this.beforeSave(data, options, /*isNew*/ false, current);
    await super.replaceById(id, data, options);
  }

  async deleteById(
    id: typeof Dataset.prototype.name,
    options?: Options,
  ): Promise<void> {
    await this.beforeDelete(String(id), options);
    await super.deleteById(id, options);
  }

  async deleteAll(where?: Where<Dataset>, options?: Options): Promise<Count> {
    const datasetIds = this.extractDatasetIds(where);
    if (datasetIds.length) {
      await Promise.all(datasetIds.map(id => this.beforeDelete(id, options)));
    }
    return super.deleteAll(where, options);
  }

  /** translated from LB3 : Dataset.observe('before delete', ) in lb4app/lb3app/common/models/dataset.js */
  private async beforeDelete(datasetId: string, options?: Options) {
    if (!datasetId) return;
    const blockRepo = await this.blockRepositoryGetter();
    const blocks = await blockRepo.find({where: {datasetId}}, options);
    await Promise.all(blocks.map(block => blockRepo.deleteById(block.id, options)));
  }

  /** translated from LB3 : Dataset.observe('before save', ) in lb4app/lb3app/common/models/dataset.js */
  private async beforeSave(
    data: Partial<Dataset> | undefined,
    options: Options | undefined,
    isNew: boolean,
    current?: Dataset,
  ) {
    const
    fnName = 'DatasetRepository:beforeSave',
    dataset = isNew ? data : current;
    if (!data || typeof data !== 'object') {
      console.log(fnName, ''+dataset?.id, dataset);
      return;
    }
    /** If dataset is a copy from another server (it has ._origin), then the
     * group is an object of the remote server, which does any required group
     * permission check.
     */
    const metaOrigin = (data as any).meta?._origin ?? (current as any)?.meta?._origin;
    if ((data as any).groupId && !metaOrigin) {
      /** similar : models/group.js : sessionClientId(context),
       * utilities/identity.js : gatherClientId() */
      const accessToken = (options as any)?.accessToken;
      const clientId = accessToken?.userId;
      const groupId = (data as any).groupId;
      const writable = groupIsWritable(groupId);
      const ok =
        (writable && clientIsInGroup(clientId, groupId)) ||
        clientOwnsGroup(clientId, groupId);
      if (!ok) {
        // Don't save
        const datasetId = (data as any).id ?? (current as any)?.id;
        const soText = ' so they cannot set that as group of dataset ' + datasetId;
        const errorText = writable
          ? 'User ' + clientId + ' is not a member of group ' + groupId + soText
          : 'User ' + clientId + ' is not owner of group ' + groupId + ' which is not writable,' + soText;
        throw ErrorStatus(403, errorText);
      }
    }

    if (isNew) {
      /** create : ctx.instance is defined, instead of .currentInstance, .where and .data */
      if ((data as any).public && (data as any).groupId) {
        (data as any).groupId = null; // LB3 : or dataset.setAttribute('groupId',  )
      }
    } else {
      /** check the new value if changing, or otherwise the current value. */
      const isPublic =
        Object.prototype.hasOwnProperty.call(data, 'public')
          ? (data as any).public
          : (current as any)?.public;
      const groupId = (data as any).groupId ?? (current as any)?.groupId;
      if (isPublic && groupId) {
        (data as any).groupId = null;
      }
    }
  }

  private extractDatasetIds(where?: Where<Dataset>): string[] {
    if (!where) return [];
    const ids: string[] = [];
    const pushId = (value: unknown) => {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(v => pushId(v));
      } else if (typeof value === 'string' || typeof value === 'number') {
        ids.push(String(value));
      } else if (typeof value === 'object' && value && (value as any).inq) {
        pushId((value as any).inq);
      }
    };
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.name) pushId(node.name);
      if (node.id) pushId(node.id);
      if (node._id) pushId(node._id);
      if (Array.isArray(node.and)) node.and.forEach(visit);
      if (Array.isArray(node.or)) node.or.forEach(visit);
    };
    visit(where as any);
    return Array.from(new Set(ids));
  }
}
