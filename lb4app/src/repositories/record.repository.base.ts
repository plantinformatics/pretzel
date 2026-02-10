import {inject, Getter} from '@loopback/core';
import {Entity, DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
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
}
