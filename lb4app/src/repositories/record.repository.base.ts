import {inject, Getter} from '@loopback/core';
import {
  Entity,
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
  DataObject,
  Options,
} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Client, Group} from '../models';
import {ClientRepository} from './client.repository';
import {GroupRepository} from './group.repository';



export class RecordBaseRepository<
  T extends Entity,
  ID,
  Relations extends object = {}
> extends DefaultCrudRepository<T, ID, Relations> {

  public readonly client: BelongsToAccessor<Client, ID>;

  public readonly group: BelongsToAccessor<Group, ID>;

  constructor(
    entityClass: typeof Entity & {prototype: T},
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
    @repository.getter('ClientRepository') protected clientRepositoryGetter: Getter<ClientRepository>,
    @repository.getter('GroupRepository') protected groupRepositoryGetter: Getter<GroupRepository>,
  ) {
    super(entityClass, dataSource);
    this.group = this.createBelongsToAccessorFor('group', groupRepositoryGetter,);
    this.registerInclusionResolver('group', this.group.inclusionResolver);

    this.client = this.createBelongsToAccessorFor('client', clientRepositoryGetter,);
    this.registerInclusionResolver('client', this.client.inclusionResolver);
  }

  async create(entity: DataObject<T>, options?: Options): Promise<T> {
    this.applyRecordBeforeSave(entity, options, true);
    return super.create(entity, options);
  }

  async updateById(id: ID, data: DataObject<T>, options?: Options): Promise<void> {
    this.applyRecordBeforeSave(data, options, false);
    await super.updateById(id, data, options);
  }

  async replaceById(id: ID, data: DataObject<T>, options?: Options): Promise<void> {
    this.applyRecordBeforeSave(data, options, false);
    await super.replaceById(id, data, options);
  }

  protected applyRecordBeforeSave(
    data: DataObject<T> | undefined,
    options: Options | undefined,
    isNew: boolean,
  ) {
    if (!data || typeof data !== 'object') return;
    const instance = data as {[key: string]: unknown};
    const now = new Date();
    if (isNew) {
      const clientId = this.getClientIdFromOptions(options);
      if (clientId) {
        instance.clientId = clientId;
      } else {
        instance.public = true;
        instance.readOnly = false;
      }
      instance.createdAt = now;
      instance.updatedAt = now;
      return;
    }
    instance.updatedAt = now;
  }

  protected getClientIdFromOptions(options?: Options): string | undefined {
    const accessToken = (options as any)?.accessToken;
    const userId = accessToken && typeof accessToken === 'object'
      ? accessToken.userId
      : undefined;
    if (userId == null) return undefined;
    return String(userId);
  }
}
