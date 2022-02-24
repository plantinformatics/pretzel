import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Group, GroupRelations} from '../models';

export class GroupRepository extends DefaultCrudRepository<
  Group,
  typeof Group.prototype.id,
  GroupRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(Group, dataSource);
  }
}
