import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {ApplicationCredential, ApplicationCredentialRelations} from '../models';

export class ApplicationCredentialRepository extends DefaultCrudRepository<
  ApplicationCredential,
  typeof ApplicationCredential.prototype.id,
  ApplicationCredentialRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(ApplicationCredential, dataSource);
  }
}
