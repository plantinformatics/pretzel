import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {ClientGroup, ClientGroupRelations} from '../models';

export class ClientGroupRepository extends DefaultCrudRepository<
  ClientGroup,
  typeof ClientGroup.prototype.id,
  ClientGroupRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(ClientGroup, dataSource);
  }
}
