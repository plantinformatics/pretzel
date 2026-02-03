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
  ClientGroup,
} from '../models';
import {ClientRepository} from '../repositories';

export class ClientClientGroupController {
  constructor(
    @repository(ClientRepository) protected clientRepository: ClientRepository,
  ) { }

  @get('/clients/{id}/client-groups', {
    responses: {
      '200': {
        description: 'Array of Client has many ClientGroup',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(ClientGroup)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<ClientGroup>,
  ): Promise<ClientGroup[]> {
    return this.clientRepository.clientGroups(id).find(filter);
  }

  @post('/clients/{id}/client-groups', {
    responses: {
      '200': {
        description: 'Client model instance',
        content: {'application/json': {schema: getModelSchemaRef(ClientGroup)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Client.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ClientGroup, {
            title: 'NewClientGroupInClient',
            exclude: ['id'],
            optional: ['clientId']
          }),
        },
      },
    }) clientGroup: Omit<ClientGroup, 'id'>,
  ): Promise<ClientGroup> {
    return this.clientRepository.clientGroups(id).create(clientGroup);
  }

  @patch('/clients/{id}/client-groups', {
    responses: {
      '200': {
        description: 'Client.ClientGroup PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ClientGroup, {partial: true}),
        },
      },
    })
    clientGroup: Partial<ClientGroup>,
    @param.query.object('where', getWhereSchemaFor(ClientGroup)) where?: Where<ClientGroup>,
  ): Promise<Count> {
    return this.clientRepository.clientGroups(id).patch(clientGroup, where);
  }

  @del('/clients/{id}/client-groups', {
    responses: {
      '200': {
        description: 'Client.ClientGroup DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(ClientGroup)) where?: Where<ClientGroup>,
  ): Promise<Count> {
    return this.clientRepository.clientGroups(id).delete(where);
  }
}
