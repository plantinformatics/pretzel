import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {Block} from '../models';
import {BlockRepository} from '../repositories';

export class BlockController {
  constructor(
    @repository(BlockRepository)
    public blockRepository : BlockRepository,
  ) {}

  @post('/blocks')
  @response(200, {
    description: 'Block model instance',
    content: {'application/json': {schema: getModelSchemaRef(Block)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Block, {
            title: 'NewBlock',
            exclude: ['id'],
          }),
        },
      },
    })
    block: Omit<Block, 'id'>,
  ): Promise<Block> {
    return this.blockRepository.create(block);
  }

  @get('/blocks/count')
  @response(200, {
    description: 'Block model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Block) where?: Where<Block>,
  ): Promise<Count> {
    return this.blockRepository.count(where);
  }

  @get('/blocks')
  @response(200, {
    description: 'Array of Block model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Block, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Block) filter?: Filter<Block>,
  ): Promise<Block[]> {
    return this.blockRepository.find(filter);
  }

  @patch('/blocks')
  @response(200, {
    description: 'Block PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Block, {partial: true}),
        },
      },
    })
    block: Block,
    @param.where(Block) where?: Where<Block>,
  ): Promise<Count> {
    return this.blockRepository.updateAll(block, where);
  }

  @get('/blocks/{id}')
  @response(200, {
    description: 'Block model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Block, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Block, {exclude: 'where'}) filter?: FilterExcludingWhere<Block>
  ): Promise<Block> {
    return this.blockRepository.findById(id, filter);
  }

  @patch('/blocks/{id}')
  @response(204, {
    description: 'Block PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Block, {partial: true}),
        },
      },
    })
    block: Block,
  ): Promise<void> {
    await this.blockRepository.updateById(id, block);
  }

  @put('/blocks/{id}')
  @response(204, {
    description: 'Block PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() block: Block,
  ): Promise<void> {
    await this.blockRepository.replaceById(id, block);
  }

  @del('/blocks/{id}')
  @response(204, {
    description: 'Block DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.blockRepository.deleteById(id);
  }
}
