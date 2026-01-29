import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Block, BlockRelations, Annotation} from '../models';
import {AnnotationRepository} from './annotation.repository';

export class BlockRepository extends DefaultCrudRepository<
  Block,
  typeof Block.prototype.id,
  BlockRelations
> {

  public readonly annotations: HasManyRepositoryFactory<Annotation, typeof Block.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('AnnotationRepository') protected annotationRepositoryGetter: Getter<AnnotationRepository>,
  ) {
    super(Block, dataSource);
    this.annotations = this.createHasManyRepositoryFactoryFor('annotations', annotationRepositoryGetter,);
    this.registerInclusionResolver('annotations', this.annotations.inclusionResolver);
  }
}
