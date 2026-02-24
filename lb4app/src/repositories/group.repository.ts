import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor, HasManyRepositoryFactory, Options} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Group, GroupRelations, Client, ClientGroup} from '../models';
import {ClientRepository} from './client.repository';
import {ClientGroupRepository} from './client-group.repository';
import {clientGroups} from '../utils/client-groups';

export class GroupRepository extends DefaultCrudRepository<
  Group,
  typeof Group.prototype.id,
  GroupRelations
> {

  public readonly owner: BelongsToAccessor<Client, typeof Group.prototype.id>;

  public readonly clientGroups: HasManyRepositoryFactory<ClientGroup, typeof Group.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('ClientRepository') protected clientRepositoryGetter: Getter<ClientRepository>, @repository.getter('ClientGroupRepository') protected clientGroupRepositoryGetter: Getter<ClientGroupRepository>,
  ) {
    super(Group, dataSource);
    this.clientGroups = this.createHasManyRepositoryFactoryFor('clientGroups', clientGroupRepositoryGetter,);
    this.registerInclusionResolver(
      'clientGroups',
      this.clientGroups.inclusionResolver,
    );

    this.owner = this.createBelongsToAccessorFor('owner', clientRepositoryGetter,);
    this.registerInclusionResolver('owner', this.owner.inclusionResolver);
  }

  async create(entity: Omit<Group, "id">, options?: Options): Promise<Group> {
    const result = await super.create(entity, options);
    await clientGroups.update();
    return result;
  }

  async updateById(id: typeof Group.prototype.id, data: Partial<Group>, options?: Options): Promise<void> {
    await super.updateById(id, data, options);
    await clientGroups.update();
  }

  async replaceById(id: typeof Group.prototype.id, data: Group, options?: Options): Promise<void> {
    await super.replaceById(id, data, options);
    await clientGroups.update();
  }

  async deleteById(id: typeof Group.prototype.id, options?: Options): Promise<void> {
    await super.deleteById(id, options);
    await clientGroups.update();
  }
}
