import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Feature, FeatureRelations, Block} from '../models';
import {BlockRepository} from './block.repository';

export class FeatureRepository extends DefaultCrudRepository<
  Feature,
  typeof Feature.prototype.id,
  FeatureRelations
> {

  public readonly block: BelongsToAccessor<Block, typeof Feature.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>,
  ) {
    super(Feature, dataSource);
    this.block = this.createBelongsToAccessorFor('block', blockRepositoryGetter,);
  }
}
