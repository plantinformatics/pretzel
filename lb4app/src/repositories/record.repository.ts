import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Record, RecordRelations, Client, Group} from '../models';
import {ClientRepository} from './client.repository';
import {GroupRepository} from './group.repository';

export class RecordRepository extends DefaultCrudRepository<
  Record,
  typeof Record.prototype.id,
  RecordRelations
> {

  public readonly client: BelongsToAccessor<Client, typeof Record.prototype.id>;

  public readonly group: BelongsToAccessor<Group, typeof Record.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('ClientRepository') protected clientRepositoryGetter: Getter<ClientRepository>, @repository.getter('GroupRepository') protected groupRepositoryGetter: Getter<GroupRepository>,
  ) {
    super(Record, dataSource);
    this.group = this.createBelongsToAccessorFor('group', groupRepositoryGetter,);
    this.registerInclusionResolver('group', this.group.inclusionResolver);

    this.client = this.createBelongsToAccessorFor('client', clientRepositoryGetter,);
    this.registerInclusionResolver('client', this.client.inclusionResolver);
  }
}
