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
import {ClientGroup} from '../models';
import {ClientGroupRepository} from '../repositories';

export class ClientGroupController {
  constructor(
    @repository(ClientGroupRepository)
    public clientGroupRepository : ClientGroupRepository,
  ) {}

  @post('/api/client-groups')
  @response(200, {
    description: 'ClientGroup model instance',
    content: {'application/json': {schema: getModelSchemaRef(ClientGroup)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ClientGroup, {
            title: 'NewClientGroup',
            exclude: ['id'],
          }),
        },
      },
    })
    clientGroup: Omit<ClientGroup, 'id'>,
  ): Promise<ClientGroup> {
    return this.clientGroupRepository.create(clientGroup);
  }

  @get('/client-groups/count')
  @response(200, {
    description: 'ClientGroup model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(ClientGroup) where?: Where<ClientGroup>,
  ): Promise<Count> {
    return this.clientGroupRepository.count(where);
  }

  @get('/client-groups')
  @response(200, {
    description: 'Array of ClientGroup model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(ClientGroup, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(ClientGroup) filter?: Filter<ClientGroup>,
  ): Promise<ClientGroup[]> {
    return this.clientGroupRepository.find(filter);
  }

  @patch('/client-groups')
  @response(200, {
    description: 'ClientGroup PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ClientGroup, {partial: true}),
        },
      },
    })
    clientGroup: ClientGroup,
    @param.where(ClientGroup) where?: Where<ClientGroup>,
  ): Promise<Count> {
    return this.clientGroupRepository.updateAll(clientGroup, where);
  }

  @get('/client-groups/{id}')
  @response(200, {
    description: 'ClientGroup model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(ClientGroup, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(ClientGroup, {exclude: 'where'}) filter?: FilterExcludingWhere<ClientGroup>
  ): Promise<ClientGroup> {
    return this.clientGroupRepository.findById(id, filter);
  }

  @patch('/client-groups/{id}')
  @response(204, {
    description: 'ClientGroup PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ClientGroup, {partial: true}),
        },
      },
    })
    clientGroup: ClientGroup,
  ): Promise<void> {
    await this.clientGroupRepository.updateById(id, clientGroup);
  }

  @put('/client-groups/{id}')
  @response(204, {
    description: 'ClientGroup PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() clientGroup: ClientGroup,
  ): Promise<void> {
    await this.clientGroupRepository.replaceById(id, clientGroup);
  }

  @del('/client-groups/{id}')
  @response(204, {
    description: 'ClientGroup DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.clientGroupRepository.deleteById(id);
  }
}
