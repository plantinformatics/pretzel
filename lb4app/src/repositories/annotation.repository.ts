import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Annotation, AnnotationRelations, Block} from '../models';
import {BlockRepository} from './block.repository';

export class AnnotationRepository extends DefaultCrudRepository<
  Annotation,
  typeof Annotation.prototype.id,
  AnnotationRelations
> {

  public readonly block: BelongsToAccessor<Block, typeof Annotation.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>,
  ) {
    super(Annotation, dataSource);
    this.registerInclusionResolver('block', this.block.inclusionResolver);
    this.block = this.createBelongsToAccessorFor('block', blockRepositoryGetter,);
  }
}
