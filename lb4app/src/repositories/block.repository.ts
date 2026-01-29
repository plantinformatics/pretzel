import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Block, BlockRelations, Annotation, Feature} from '../models';
import {AnnotationRepository} from './annotation.repository';
import {FeatureRepository} from './feature.repository';

export class BlockRepository extends DefaultCrudRepository<
  Block,
  typeof Block.prototype.id,
  BlockRelations
> {

  public readonly annotations: HasManyRepositoryFactory<Annotation, typeof Block.prototype.id>;

  public readonly features: HasManyRepositoryFactory<Feature, typeof Block.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('AnnotationRepository') protected annotationRepositoryGetter: Getter<AnnotationRepository>, @repository.getter('FeatureRepository') protected featureRepositoryGetter: Getter<FeatureRepository>,
  ) {
    super(Block, dataSource);
    this.features = this.createHasManyRepositoryFactoryFor('features', featureRepositoryGetter,);
    this.registerInclusionResolver('features', this.features.inclusionResolver);

    this.annotations = this.createHasManyRepositoryFactoryFor('annotations', annotationRepositoryGetter,);
    this.registerInclusionResolver('annotations', this.annotations.inclusionResolver);
  }
}
