import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor, Options} from '@loopback/repository';
import {HttpErrors} from '@loopback/rest';
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
    /* This is used in Group.in() (lb4app/lb3app/common/models/group.js) which
     * includes group in the result of ClientGroup.find().  */
    this.registerInclusionResolver('group', this.group.inclusionResolver);
    this.client = this.createBelongsToAccessorFor('client', clientRepositoryGetter,);
    // may not be required.
    this.registerInclusionResolver('client', this.client.inclusionResolver);
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
    await this.beforeDelete(id, options);
    await super.deleteById(id, options);
    await clientGroups.update();
  }

  private async beforeDelete(id: typeof ClientGroup.prototype.id, options?: Options): Promise<void> {
    const clientId = this.getClientIdFromOptions(options);
    if (!clientId || id == null) return;

    const clientGroup = await this.findById(id);
    const groupId = clientGroup.groupId?.toString();
    if (!groupId) {
      throw new HttpErrors.Conflict(`Given ClientGroup id ${id} does not refer to an existing Group`);
    }

    const group = await this.groupRepositoryGetter().then(repo => repo.findById(groupId));
    const groupOwnerId = group.clientId?.toString();
    if (groupOwnerId !== clientId) {
      throw new HttpErrors.Forbidden(
        'Group is not owned by logged-in user; rejecting deletion request',
      );
    }
  }

  private getClientIdFromOptions(options?: Options): string | undefined {
    const accessToken = (options as any)?.accessToken;
    const userId = accessToken && typeof accessToken === 'object'
      ? accessToken.userId
      : undefined;
    if (userId == null) return undefined;
    return String(userId);
  }
}
