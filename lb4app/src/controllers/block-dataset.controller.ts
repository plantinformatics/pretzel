import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Block,
  Dataset,
} from '../models';
import {BlockRepository} from '../repositories';

export class BlockDatasetController {
  constructor(
    @repository(BlockRepository)
    public blockRepository: BlockRepository,
  ) { }

  @get('/blocks/{id}/dataset', {
    responses: {
      '200': {
        description: 'Dataset belonging to Block',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Dataset),
          },
        },
      },
    },
  })
  async getDataset(
    @param.path.string('id') id: typeof Block.prototype.id,
  ): Promise<Dataset> {
    return this.blockRepository.dataset(id);
  }
}
