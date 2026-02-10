import {inject, Getter} from '@loopback/core';
import {repository, HasManyRepositoryFactory, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Dataset, DatasetRelations, Block} from '../models';
import {RecordBaseRepository} from './record.repository.base';
import {BlockRepository} from './block.repository';
import {GroupRepository} from './group.repository';
import {ClientRepository} from './client.repository';

export class DatasetRepository extends RecordBaseRepository<
  Dataset,
  typeof Dataset.prototype.name,
  DatasetRelations
> {

  public readonly blocks: HasManyRepositoryFactory<Block, typeof Dataset.prototype.name>;

  public readonly parentId: BelongsToAccessor<Dataset, typeof Dataset.prototype.name>;

  public readonly children: HasManyRepositoryFactory<Dataset, typeof Dataset.prototype.name>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
    @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>,
    @repository.getter('GroupRepository') protected groupRepositoryGetter: Getter<GroupRepository>,
    @repository.getter('DatasetRepository') protected datasetRepositoryGetter: Getter<DatasetRepository>,
    @repository.getter('ClientRepository') protected clientRepositoryGetter: Getter<ClientRepository>,
  ) {
    super(Dataset, dataSource, clientRepositoryGetter, groupRepositoryGetter);
    this.children = this.createHasManyRepositoryFactoryFor('children', datasetRepositoryGetter,);
    this.parentId = this.createBelongsToAccessorFor('parentId', datasetRepositoryGetter,);
    this.blocks = this.createHasManyRepositoryFactoryFor('blocks', blockRepositoryGetter,);
    this.registerInclusionResolver('blocks', this.blocks.inclusionResolver);
  }
}
