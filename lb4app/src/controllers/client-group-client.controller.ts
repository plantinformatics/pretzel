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
  Client,
} from '../models';
import {ClientGroupRepository} from '../repositories';

export class ClientGroupClientController {
  constructor(
    @repository(ClientGroupRepository)
    public clientGroupRepository: ClientGroupRepository,
  ) { }

  @get('/client-groups/{id}/client', {
    responses: {
      '200': {
        description: 'Client belonging to ClientGroup',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Client),
          },
        },
      },
    },
  })
  async getClient(
    @param.path.string('id') id: typeof ClientGroup.prototype.id,
  ): Promise<Client> {
    return this.clientGroupRepository.client(id);
  }
}
