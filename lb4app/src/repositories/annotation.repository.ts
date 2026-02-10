import {inject, Getter} from '@loopback/core';
import {repository, BelongsToAccessor} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Annotation, AnnotationRelations, Block, Feature} from '../models';
import {BlockRepository} from './block.repository';
import {FeatureRepository} from './feature.repository';
import {RecordBaseRepository} from './record.repository.base';
import {ClientRepository} from './client.repository';
import {GroupRepository} from './group.repository';


export class AnnotationRepository extends RecordBaseRepository<
  Annotation,
  typeof Annotation.prototype.id,
  AnnotationRelations
> {

  public readonly block: BelongsToAccessor<Block, typeof Annotation.prototype.id>;

  public readonly feature: BelongsToAccessor<Feature, typeof Annotation.prototype.id>;

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
    @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>,
    @repository.getter('FeatureRepository') protected featureRepositoryGetter: Getter<FeatureRepository>,
    @repository.getter('GroupRepository') protected groupRepositoryGetter: Getter<GroupRepository>,
    @repository.getter('ClientRepository') protected clientRepositoryGetter: Getter<ClientRepository>,
  ) {
    super(Annotation, dataSource, clientRepositoryGetter, groupRepositoryGetter);
    this.feature = this.createBelongsToAccessorFor('feature', featureRepositoryGetter,);
    this.registerInclusionResolver('feature', this.feature.inclusionResolver);

    this.block = this.createBelongsToAccessorFor('block', blockRepositoryGetter,);
    // probably don't want to include block or feature with annotation
    this.registerInclusionResolver('block', this.block.inclusionResolver);
  }
}
