import {inject, Getter} from '@loopback/core';
import {DefaultCrudRepository, repository, HasManyRepositoryFactory} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Client, ClientRelations, ClientGroup, Dataset, Block, Annotation, Interval} from '../models';
import {ClientGroupRepository} from './client-group.repository';
import {DatasetRepository} from './dataset.repository';
import {BlockRepository} from './block.repository';
import {AnnotationRepository} from './annotation.repository';
import {IntervalRepository} from './interval.repository';

export class ClientRepository extends DefaultCrudRepository<
  Client,
  typeof Client.prototype.id,
  ClientRelations
> {

  public readonly clientGroups: HasManyRepositoryFactory<ClientGroup, typeof Client.prototype.id>;

  public readonly datasets: HasManyRepositoryFactory<Dataset, typeof Client.prototype.id>;

  public readonly blocks: HasManyRepositoryFactory<Block, typeof Client.prototype.id>;

  public readonly annotations: HasManyRepositoryFactory<Annotation, typeof Client.prototype.id>;

  public readonly intervals: HasManyRepositoryFactory<Interval, typeof Client.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource, @repository.getter('ClientGroupRepository') protected clientGroupRepositoryGetter: Getter<ClientGroupRepository>, @repository.getter('DatasetRepository') protected datasetRepositoryGetter: Getter<DatasetRepository>, @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>, @repository.getter('AnnotationRepository') protected annotationRepositoryGetter: Getter<AnnotationRepository>, @repository.getter('IntervalRepository') protected intervalRepositoryGetter: Getter<IntervalRepository>,
  ) {
    super(Client, dataSource);
    this.intervals = this.createHasManyRepositoryFactoryFor('intervals', intervalRepositoryGetter,);
    this.annotations = this.createHasManyRepositoryFactoryFor('annotations', annotationRepositoryGetter,);
    this.blocks = this.createHasManyRepositoryFactoryFor('blocks', blockRepositoryGetter,);
    this.datasets = this.createHasManyRepositoryFactoryFor('datasets', datasetRepositoryGetter,);
    this.clientGroups = this.createHasManyRepositoryFactoryFor('clientGroups', clientGroupRepositoryGetter,);
    this.registerInclusionResolver('clientGroups', this.clientGroups.inclusionResolver);
  }
}
