import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Annotation, AnnotationRelations, Block, Feature} from '../models';
import {BlockRepository} from './block.repository';
import {FeatureRepository} from './feature.repository';

export class AnnotationRepository extends DefaultCrudRepository<
  Annotation,
  typeof Annotation.prototype.id,
  AnnotationRelations
> {

  public readonly block: BelongsToAccessor<Block, typeof Annotation.prototype.id>;

  public readonly feature: BelongsToAccessor<Feature, typeof Annotation.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>, @repository.getter('FeatureRepository') protected featureRepositoryGetter: Getter<FeatureRepository>,
  ) {
    super(Annotation, dataSource);
    this.feature = this.createBelongsToAccessorFor('feature', featureRepositoryGetter,);
    this.registerInclusionResolver('feature', this.feature.inclusionResolver);

    this.registerInclusionResolver('block', this.block.inclusionResolver);
    this.block = this.createBelongsToAccessorFor('block', blockRepositoryGetter,);
  }
}
