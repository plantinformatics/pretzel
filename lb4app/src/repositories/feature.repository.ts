import {inject, Getter} from '@loopback/core';
import {
  DefaultCrudRepository,
  repository,
  BelongsToAccessor,
  HasManyRepositoryFactory,
  Options,
} from '@loopback/repository';
import {MongoDsDataSource} from '../datasources';
import {Feature, FeatureRelations, Block} from '../models';
import {BlockRepository} from './block.repository';
// @ts-ignore
const {ArgsDebounce} = require('../../lb3app/common/utilities/debounce-args');
// @ts-ignore
const FeatureModule = require('../../lb3app/common/models/feature');

import {Lb3ModelClass} from '../utils/lb3-model-wrap';
/** Copy Lb3ModelClass to avoid modifying it in FeatureModule. */
class FeatureClass extends Lb3ModelClass { };
FeatureModule(FeatureClass);
const featureAfterSave = (FeatureClass as any).featureAfterSave;


export class FeatureRepository extends DefaultCrudRepository<
  Feature,
  typeof Feature.prototype.id,
  FeatureRelations
> {

  public readonly block: BelongsToAccessor<Block, typeof Feature.prototype.id>;

  public readonly parent: BelongsToAccessor<Feature, typeof Feature.prototype.id>;

  public readonly features: HasManyRepositoryFactory<Feature, typeof Feature.prototype.id>;

  private argsDebounce = new ArgsDebounce();

  constructor(
    @inject('datasources.mongoDs') dataSource: MongoDsDataSource,
    @repository.getter('BlockRepository') protected blockRepositoryGetter: Getter<BlockRepository>,
    @repository.getter('FeatureRepository') protected featureRepositoryGetter: Getter<FeatureRepository>,
  ) {
    super(Feature, dataSource);
    this.features = this.createHasManyRepositoryFactoryFor('features', featureRepositoryGetter,);
    this.parent = this.createBelongsToAccessorFor('parent', featureRepositoryGetter,);
    this.block = this.createBelongsToAccessorFor('block', blockRepositoryGetter,);
    // This is used by Feature.search() { ... .find ... include ... relation : "block"
    this.registerInclusionResolver('block', this.block.inclusionResolver);
  }

  async create(entity: Partial<Feature>, options?: Options): Promise<Feature> {
    const result = await super.create(entity, options);
    this.afterSave((result as any)?.blockId);
    return result;
  }

  async updateById(
    id: typeof Feature.prototype.id,
    data: Partial<Feature>,
    options?: Options,
  ): Promise<void> {
    await super.updateById(id, data, options);
    let blockId = (data as any)?.blockId;
    if (!blockId && id) {
      try {
        const feature = await this.findById(id, {
          fields: {blockId: true},
        } as any);
        blockId = (feature as any)?.blockId;
      } catch {
        // ignore lookup errors
      }
    }
    this.afterSave(blockId);
  }

  async replaceById(
    id: typeof Feature.prototype.id,
    data: Feature,
    options?: Options,
  ): Promise<void> {
    await super.replaceById(id, data, options);
    let blockId = (data as any)?.blockId;
    if (!blockId && id) {
      try {
        const feature = await this.findById(id, {
          fields: {blockId: true},
        } as any);
        blockId = (feature as any)?.blockId;
      } catch {
        // ignore lookup errors
      }
    }
    this.afterSave(blockId);
  }

  private afterSave(blockId: unknown) {
    if (!blockId || typeof featureAfterSave !== 'function') return;
    this.argsDebounce.debounced(featureAfterSave, String(blockId), 1000)();
  }
}
