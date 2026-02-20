import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  HasManyRepositoryFactory,
  BelongsToAccessor,
  Where,
  Options,
  Count,
} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Block, BlockRelations, Annotation, Feature, Interval, Dataset} from '../models';
import {AnnotationRepository} from './annotation.repository';
import {FeatureRepository} from './feature.repository';
import {IntervalRepository} from './interval.repository';
import {DatasetRepository} from './dataset.repository';
// @ts-ignore
const {ArgsDebounce} = require('../../lb3app/common/utilities/debounce-args');
// @ts-ignore
const blockFeatures = require('../../lb3app/common/utilities/block-features');
// @ts-ignore
const cache = require('../../lb3app/common/utilities/results-cache');

export class BlockRepository extends DefaultCrudRepository<
  Block,
  typeof Block.prototype.id,
  BlockRelations
> {

  public readonly annotations: HasManyRepositoryFactory<Annotation, typeof Block.prototype.id>;

  public readonly features: HasManyRepositoryFactory<Feature, typeof Block.prototype.id>;

  public readonly intervals: HasManyRepositoryFactory<Interval, typeof Block.prototype.id>;

  public readonly dataset: BelongsToAccessor<Dataset, typeof Block.prototype.id>;

  private argsDebounce = new ArgsDebounce();

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

  async create(entity: Partial<Block>, options?: Options): Promise<Block> {
    this.applyNameDefaults(entity);
    const result = await super.create(entity, options);
    this.afterSave(result.id?.toString());
    return result;
  }

  async updateById(id: typeof Block.prototype.id, data: Partial<Block>, options?: Options): Promise<void> {
    await super.updateById(id, data, options);
    if (id) this.afterSave(id.toString());
  }

  async replaceById(id: typeof Block.prototype.id, data: Block, options?: Options): Promise<void> {
    this.applyNameDefaults(data);
    await super.replaceById(id, data, options);
    if (id) this.afterSave(id.toString());
  }

  async deleteById(id: typeof Block.prototype.id, options?: Options): Promise<void> {
    await this.beforeDelete(id);
    return super.deleteById(id, options);
  }

  async deleteAll(where?: Where<Block>, options?: Options): Promise<Count> {
    await this.beforeDeleteAll(where);
    return super.deleteAll(where, options);
  }

  private applyNameDefaults(instance: Partial<Block> | undefined) {
    if (!instance || typeof instance !== 'object') return;
    if (!instance.name) {
      if (instance.scope) {
        instance.name = instance.scope;
      } else if (instance.namespace) {
        instance.name = instance.namespace;
      }
    }
  }

  private async beforeDelete(blockId: unknown) {
    if (blockId == null) return;
    const id = String(blockId);
    const featureRepo = await this.featureRepositoryGetter();
    const annotationRepo = await this.annotationRepositoryGetter();
    const intervalRepo = await this.intervalRepositoryGetter();
    await featureRepo.deleteAll({blockId: id});
    const annotations = await annotationRepo.find({where: {blockId: id}});
    await Promise.all(annotations.map(a => annotationRepo.deleteById(a.id)));
    const intervals = await intervalRepo.find({where: {blockId: id}});
    await Promise.all(intervals.map(i => intervalRepo.deleteById(i.id)));
  }

  private async beforeDeleteAll(where?: Where<Block>) {
    const id = (where as any)?.id;
    if (!id) return;
    if (Array.isArray(id?.inq)) {
      await Promise.all(id.inq.map((blockId: unknown) => this.beforeDelete(blockId)));
    } else {
      await this.beforeDelete(id);
    }
  }

  private afterSave(blockId?: string) {
    if (!blockId) return;
    this.argsDebounce.debounced(this.blockAfterSave.bind(this), blockId, 1000)();
  }

  private blockAfterSave(blockId: string) {
    const apiName = 'blockFeaturesInterval';
    const cacheId = `${apiName}_${blockId}`;
    const value = cache.get(cacheId);
    if (value) {
      // eslint-disable-next-line no-console
      console.log(apiName, 'remove from cache', cacheId, value.length || value);
      cache.put(cacheId, undefined);
    }
    blockFeatures.blockFeaturesCacheClear(cache);
  }
}
