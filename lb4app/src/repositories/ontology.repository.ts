import {inject} from '@loopback/core';
import {DefaultCrudRepository} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Ontology, OntologyRelations} from '../models';

export class OntologyRepository extends DefaultCrudRepository<
  Ontology,
  typeof Ontology.prototype.id,
  OntologyRelations
> {
  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
  ) {
    super(Ontology, dataSource);
  }
}
