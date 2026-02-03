import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {ClientGroup, ClientGroupRelations, Client, Group} from '../models';
import {ClientRepository} from './client.repository';
import {GroupRepository} from './group.repository';

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
}
