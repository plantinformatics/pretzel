import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Record, RecordRelations, Client} from '../models';
import {ClientRepository} from './client.repository';

export class RecordRepository extends DefaultCrudRepository<
  Record,
  typeof Record.prototype.id,
  RecordRelations
> {

  public readonly client: BelongsToAccessor<Client, typeof Record.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('ClientRepository') protected clientRepositoryGetter: Getter<ClientRepository>,
  ) {
    super(Record, dataSource);
    this.client = this.createBelongsToAccessorFor('client', clientRepositoryGetter,);
  }
}
