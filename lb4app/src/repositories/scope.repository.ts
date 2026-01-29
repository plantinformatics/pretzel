import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Scope, ScopeRelations} from '../models';

export class ScopeRepository extends DefaultCrudRepository<
  Scope,
  typeof Scope.prototype.id,
  ScopeRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(Scope, dataSource);
  }
}
