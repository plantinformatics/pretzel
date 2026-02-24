import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor, Options} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {ClientGroup, ClientGroupRelations, Client, Group} from '../models';
import {ClientRepository} from './client.repository';
import {GroupRepository} from './group.repository';
import {clientGroups} from '../utils/client-groups';

export class ClientGroupRepository extends DefaultCrudRepository<
  ClientGroup,
  typeof ClientGroup.prototype.id,
  ClientGroupRelations
> {

  public readonly client: BelongsToAccessor<Client, typeof ClientGroup.prototype.id>;

  public readonly group: BelongsToAccessor<Group, typeof ClientGroup.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('ClientRepository') protected clientRepositoryGetter: Getter<ClientRepository>, @repository.getter('GroupRepository') protected groupRepositoryGetter: Getter<GroupRepository>,
  ) {
    super(ClientGroup, dataSource);
    this.group = this.createBelongsToAccessorFor('group', groupRepositoryGetter,);
    this.client = this.createBelongsToAccessorFor('client', clientRepositoryGetter,);
  }

  /** id is omitted, and provided by the database. */
  async create(entity: Omit<ClientGroup, "id">, options?: Options): Promise<ClientGroup> {
    const result = await super.create(entity, options);
    await clientGroups.update();
    return result;
  }

  async updateById(id: typeof ClientGroup.prototype.id, data: Partial<ClientGroup>, options?: Options): Promise<void> {
    await super.updateById(id, data, options);
    await clientGroups.update();
  }

  async replaceById(id: typeof ClientGroup.prototype.id, data: ClientGroup, options?: Options): Promise<void> {
    await super.replaceById(id, data, options);
    await clientGroups.update();
  }

  async deleteById(id: typeof ClientGroup.prototype.id, options?: Options): Promise<void> {
    await super.deleteById(id, options);
    await clientGroups.update();
  }
}
