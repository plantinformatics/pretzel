import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Dataset, DatasetRelations} from '../models';

export class DatasetRepository extends DefaultCrudRepository<
  Dataset,
  typeof Dataset.prototype.name,
  DatasetRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(Dataset, dataSource);
  }
}
