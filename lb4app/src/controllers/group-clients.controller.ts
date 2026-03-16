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
Group,
ClientGroup,
Client,
} from '../models';
import {GroupRepository} from '../repositories';

export class GroupClientsController {
  constructor(
    @repository(GroupRepository) protected groupRepository: GroupRepository,
  ) { }

  @get('/groups/{id}/clients', {
    responses: {
      '200': {
        description: 'Array of Group has many Client through ClientGroup',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Client)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Client>,
  ): Promise<Client[]> {
    return this.groupRepository.clients(id).find(filter);
  }

  @post('/groups/{id}/clients', {
    responses: {
      '200': {
        description: 'create a Client model instance',
        content: {'application/json': {schema: getModelSchemaRef(Client)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Group.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Client, {
            title: 'NewClientInGroup',
            exclude: ['id'],
          }),
        },
      },
    }) client: Omit<Client, 'id'>,
  ): Promise<Client> {
    return this.groupRepository.clients(id).create(client);
  }

  @patch('/groups/{id}/clients', {
    responses: {
      '200': {
        description: 'Group.Client PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Client, {partial: true}),
        },
      },
    })
    client: Partial<Client>,
    @param.query.object('where', getWhereSchemaFor(Client)) where?: Where<Client>,
  ): Promise<Count> {
    return this.groupRepository.clients(id).patch(client, where);
  }

  @del('/groups/{id}/clients', {
    responses: {
      '200': {
        description: 'Group.Client DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Client)) where?: Where<Client>,
  ): Promise<Count> {
    return this.groupRepository.clients(id).delete(where);
  }
}
