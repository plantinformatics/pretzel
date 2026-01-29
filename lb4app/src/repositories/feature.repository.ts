import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Feature, FeatureRelations} from '../models';

export class FeatureRepository extends DefaultCrudRepository<
  Feature,
  typeof Feature.prototype.id,
  FeatureRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(Feature, dataSource);
  }
}
