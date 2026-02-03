import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Group,
  Client,
} from '../models';
import {GroupRepository} from '../repositories';

export class GroupClientController {
  constructor(
    @repository(GroupRepository)
    public groupRepository: GroupRepository,
  ) { }

  @get('/groups/{id}/client', {
    responses: {
      '200': {
        description: 'Client belonging to Group',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Client),
          },
        },
      },
    },
  })
  async getClient(
    @param.path.string('id') id: typeof Group.prototype.id,
  ): Promise<Client> {
    return this.groupRepository.owner(id);
  }
}
