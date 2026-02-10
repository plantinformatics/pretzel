import {inject, Getter} from '@loopback/core';
import {repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Interval, IntervalRelations, Block} from '../models';
import {BlockRepository} from './block.repository';
import {RecordBaseRepository} from './record.repository.base';
import {ClientRepository} from './client.repository';
import {GroupRepository} from './group.repository';


export class IntervalRepository extends RecordBaseRepository<
  Interval,
  typeof Interval.prototype.id,
  IntervalRelations
> {

  public readonly block: BelongsToAccessor<Block, typeof Interval.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
    @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>,
    @repository.getter('GroupRepository') protected groupRepositoryGetter: Getter<GroupRepository>,
    @repository.getter('ClientRepository') protected clientRepositoryGetter: Getter<ClientRepository>,
  ) {
    super(Interval, dataSource, clientRepositoryGetter, groupRepositoryGetter);
    this.block = this.createBelongsToAccessorFor('block', blockRepositoryGetter,);
    this.registerInclusionResolver('block', this.block.inclusionResolver);
  }
}
