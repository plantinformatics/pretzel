import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Dataset, DatasetRelations, Block, Group} from '../models';
import {BlockRepository} from './block.repository';
import {GroupRepository} from './group.repository';

export class DatasetRepository extends DefaultCrudRepository<
  Dataset,
  typeof Dataset.prototype.name,
  DatasetRelations
> {

  public readonly blocks: HasManyRepositoryFactory<Block, typeof Dataset.prototype.name>;

  public readonly group: BelongsToAccessor<Group, typeof Dataset.prototype.name>;

  public readonly parentId: BelongsToAccessor<Dataset, typeof Dataset.prototype.name>;

  public readonly children: HasManyRepositoryFactory<Dataset, typeof Dataset.prototype.name>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>, @repository.getter('GroupRepository') protected groupRepositoryGetter: Getter<GroupRepository>, @repository.getter('DatasetRepository') protected datasetRepositoryGetter: Getter<DatasetRepository>,
  ) {
    super(Dataset, dataSource);
    this.children = this.createHasManyRepositoryFactoryFor('children', datasetRepositoryGetter,);
    this.parentId = this.createBelongsToAccessorFor('parentId', datasetRepositoryGetter,);
    this.group = this.createBelongsToAccessorFor('group', groupRepositoryGetter,);
    this.blocks = this.createHasManyRepositoryFactoryFor('blocks', blockRepositoryGetter,);
    this.registerInclusionResolver('blocks', this.blocks.inclusionResolver);
  }
}
