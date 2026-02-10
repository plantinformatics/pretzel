import {inject, Getter} from '@loopback/core';
import {repository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Record, RecordRelations} from '../models';
import {ClientRepository} from './client.repository';
import {GroupRepository} from './group.repository';
import {RecordBaseRepository} from './record.repository.base';

export class RecordRepository extends RecordBaseRepository<
  Record,
  typeof Record.prototype.id,
  RecordRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
    @repository.getter('ClientRepository') protected clientRepositoryGetter: Getter<ClientRepository>,
    @repository.getter('GroupRepository') protected groupRepositoryGetter: Getter<GroupRepository>,
  ) {
    super(Record, dataSource, clientRepositoryGetter, groupRepositoryGetter);
  }
}
