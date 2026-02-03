import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  ClientGroup,
  Group,
} from '../models';
import {ClientGroupRepository} from '../repositories';

export class ClientGroupGroupController {
  constructor(
    @repository(ClientGroupRepository)
    public clientGroupRepository: ClientGroupRepository,
  ) { }

  @get('/client-groups/{id}/group', {
    responses: {
      '200': {
        description: 'Group belonging to ClientGroup',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Group),
          },
        },
      },
    },
  })
  async getGroup(
    @param.path.string('id') id: typeof ClientGroup.prototype.id,
  ): Promise<Group> {
    return this.clientGroupRepository.group(id);
  }
}
