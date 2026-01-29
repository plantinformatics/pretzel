import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Record, RecordRelations} from '../models';

export class RecordRepository extends DefaultCrudRepository<
  Record,
  typeof Record.prototype.id,
  RecordRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(Record, dataSource);
  }
}
