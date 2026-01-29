import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Configuration, ConfigurationRelations} from '../models';

export class ConfigurationRepository extends DefaultCrudRepository<
  Configuration,
  typeof Configuration.prototype.id,
  ConfigurationRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(Configuration, dataSource);
  }
}
