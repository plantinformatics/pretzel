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
  Client,
  Block,
} from '../models';
import {ClientRepository} from '../repositories';

export class ClientBlockController {
  constructor(
    @repository(ClientRepository) protected clientRepository: ClientRepository,
  ) { }

  @get('/clients/{id}/blocks', {
    responses: {
      '200': {
        description: 'Array of Client has many Block',
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
    return this.clientRepository.blocks(id).find(filter);
  }

  @post('/clients/{id}/blocks', {
    responses: {
      '200': {
        description: 'Client model instance',
        content: {'application/json': {schema: getModelSchemaRef(Block)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Client.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Block, {
            title: 'NewBlockInClient',
            exclude: ['id'],
            optional: ['clientId']
          }),
        },
      },
    }) block: Omit<Block, 'id'>,
  ): Promise<Block> {
    return this.clientRepository.blocks(id).create(block);
  }

  @patch('/clients/{id}/blocks', {
    responses: {
      '200': {
        description: 'Client.Block PATCH success count',
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
    return this.clientRepository.blocks(id).patch(block, where);
  }

  @del('/clients/{id}/blocks', {
    responses: {
      '200': {
        description: 'Client.Block DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Block)) where?: Where<Block>,
  ): Promise<Count> {
    return this.clientRepository.blocks(id).delete(where);
  }
}
