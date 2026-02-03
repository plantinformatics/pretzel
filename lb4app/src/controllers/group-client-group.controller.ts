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
} from '../models';
import {GroupRepository} from '../repositories';

export class GroupClientGroupController {
  constructor(
    @repository(GroupRepository) protected groupRepository: GroupRepository,
  ) { }

  @get('/groups/{id}/client-groups', {
    responses: {
      '200': {
        description: 'Array of Group has many ClientGroup',
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
    return this.groupRepository.clientGroups(id).find(filter);
  }

  @post('/groups/{id}/client-groups', {
    responses: {
      '200': {
        description: 'Group model instance',
        content: {'application/json': {schema: getModelSchemaRef(ClientGroup)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Group.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ClientGroup, {
            title: 'NewClientGroupInGroup',
            exclude: ['id'],
            optional: ['groupId']
          }),
        },
      },
    }) clientGroup: Omit<ClientGroup, 'id'>,
  ): Promise<ClientGroup> {
    return this.groupRepository.clientGroups(id).create(clientGroup);
  }

  @patch('/groups/{id}/client-groups', {
    responses: {
      '200': {
        description: 'Group.ClientGroup PATCH success count',
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
    return this.groupRepository.clientGroups(id).patch(clientGroup, where);
  }

  @del('/groups/{id}/client-groups', {
    responses: {
      '200': {
        description: 'Group.ClientGroup DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(ClientGroup)) where?: Where<ClientGroup>,
  ): Promise<Count> {
    return this.groupRepository.clientGroups(id).delete(where);
  }
}
