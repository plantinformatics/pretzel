import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Feature,
  Block,
} from '../models';
import {FeatureRepository} from '../repositories';

export class FeatureBlockController {
  constructor(
    @repository(FeatureRepository)
    public featureRepository: FeatureRepository,
  ) { }

  @get('/features/{id}/block', {
    responses: {
      '200': {
        description: 'Block belonging to Feature',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Block),
          },
        },
      },
    },
  })
  async getBlock(
    @param.path.string('id') id: typeof Feature.prototype.id,
  ): Promise<Block> {
    return this.featureRepository.block(id);
  }
}
