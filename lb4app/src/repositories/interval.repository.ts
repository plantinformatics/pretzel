import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Interval, IntervalRelations, Block} from '../models';
import {BlockRepository} from './block.repository';

export class IntervalRepository extends DefaultCrudRepository<
  Interval,
  typeof Interval.prototype.id,
  IntervalRelations
> {

  public readonly block: BelongsToAccessor<Block, typeof Interval.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>,
  ) {
    super(Interval, dataSource);
    this.block = this.createBelongsToAccessorFor('block', blockRepositoryGetter,);
  }
}
