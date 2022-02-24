import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Client, ClientRelations} from '../models';

export class ClientRepository extends DefaultCrudRepository<
  Client,
  typeof Client.prototype._id,
  ClientRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(Client, dataSource);
  }
}
