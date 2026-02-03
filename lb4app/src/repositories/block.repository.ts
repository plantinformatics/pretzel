import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Block, BlockRelations, Annotation, Feature, Interval, Dataset} from '../models';
import {AnnotationRepository} from './annotation.repository';
import {FeatureRepository} from './feature.repository';
import {IntervalRepository} from './interval.repository';
import {DatasetRepository} from './dataset.repository';

export class BlockRepository extends DefaultCrudRepository<
  Block,
  typeof Block.prototype.id,
  BlockRelations
> {

  public readonly annotations: HasManyRepositoryFactory<Annotation, typeof Block.prototype.id>;

  public readonly features: HasManyRepositoryFactory<Feature, typeof Block.prototype.id>;

  public readonly intervals: HasManyRepositoryFactory<Interval, typeof Block.prototype.id>;

  public readonly dataset: BelongsToAccessor<Dataset, typeof Block.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('AnnotationRepository') protected annotationRepositoryGetter: Getter<AnnotationRepository>, @repository.getter('FeatureRepository') protected featureRepositoryGetter: Getter<FeatureRepository>, @repository.getter('IntervalRepository') protected intervalRepositoryGetter: Getter<IntervalRepository>, @repository.getter('DatasetRepository') protected datasetRepositoryGetter: Getter<DatasetRepository>,
  ) {
    super(Block, dataSource);
    this.dataset = this.createBelongsToAccessorFor('dataset', datasetRepositoryGetter,);
    this.intervals = this.createHasManyRepositoryFactoryFor('intervals', intervalRepositoryGetter,);
    this.registerInclusionResolver('intervals', this.intervals.inclusionResolver);

    this.features = this.createHasManyRepositoryFactoryFor('features', featureRepositoryGetter,);
    this.registerInclusionResolver('features', this.features.inclusionResolver);

    this.annotations = this.createHasManyRepositoryFactoryFor('annotations', annotationRepositoryGetter,);
    this.registerInclusionResolver('annotations', this.annotations.inclusionResolver);
  }
}
