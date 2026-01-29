import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Interval, IntervalRelations} from '../models';

export class IntervalRepository extends DefaultCrudRepository<
  Interval,
  typeof Interval.prototype.id,
  IntervalRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(Interval, dataSource);
  }
}
