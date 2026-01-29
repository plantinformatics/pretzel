import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Alias, AliasRelations} from '../models';

export class AliasRepository extends DefaultCrudRepository<
  Alias,
  typeof Alias.prototype.id,
  AliasRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(Alias, dataSource);
  }
}
