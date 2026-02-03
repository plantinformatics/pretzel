import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor, HasManyRepositoryFactory} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Feature, FeatureRelations, Block} from '../models';
import {BlockRepository} from './block.repository';

export class FeatureRepository extends DefaultCrudRepository<
  Feature,
  typeof Feature.prototype.id,
  FeatureRelations
> {

  public readonly block: BelongsToAccessor<Block, typeof Feature.prototype.id>;

  public readonly parent: BelongsToAccessor<Feature, typeof Feature.prototype.id>;

  public readonly features: HasManyRepositoryFactory<Feature, typeof Feature.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>, @repository.getter('FeatureRepository') protected featureRepositoryGetter: Getter<FeatureRepository>,
  ) {
    super(Feature, dataSource);
    this.features = this.createHasManyRepositoryFactoryFor('features', featureRepositoryGetter,);
    this.parent = this.createBelongsToAccessorFor('parent', featureRepositoryGetter,);
    this.block = this.createBelongsToAccessorFor('block', blockRepositoryGetter,);
  }
}
