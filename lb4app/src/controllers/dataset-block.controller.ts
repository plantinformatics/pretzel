import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
  Dataset,
  Block,
} from '../models';
import {DatasetRepository} from '../repositories';

export class DatasetBlockController {
  constructor(
    @repository(DatasetRepository) protected datasetRepository: DatasetRepository,
  ) { }

  @get('/datasets/{id}/blocks', {
    responses: {
      '200': {
        description: 'Array of Dataset has many Block',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Block)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Block>,
  ): Promise<Block[]> {
    return this.datasetRepository.blocks(id).find(filter);
  }

  @post('/datasets/{id}/blocks', {
    responses: {
      '200': {
        description: 'Dataset model instance',
        content: {'application/json': {schema: getModelSchemaRef(Block)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Dataset.prototype.name,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Block, {
            title: 'NewBlockInDataset',
            exclude: ['id'],
            optional: ['datasetId']
          }),
        },
      },
    }) block: Omit<Block, 'id'>,
  ): Promise<Block> {
    return this.datasetRepository.blocks(id).create(block);
  }

  @patch('/datasets/{id}/blocks', {
    responses: {
      '200': {
        description: 'Dataset.Block PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Block, {partial: true}),
        },
      },
    })
    block: Partial<Block>,
    @param.query.object('where', getWhereSchemaFor(Block)) where?: Where<Block>,
  ): Promise<Count> {
    return this.datasetRepository.blocks(id).patch(block, where);
  }

  @del('/datasets/{id}/blocks', {
    responses: {
      '200': {
        description: 'Dataset.Block DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Block)) where?: Where<Block>,
  ): Promise<Count> {
    return this.datasetRepository.blocks(id).delete(where);
  }
}
