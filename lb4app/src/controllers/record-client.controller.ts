import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Record,
  Client,
} from '../models';
import {RecordRepository} from '../repositories';

export class RecordClientController {
  constructor(
    @repository(RecordRepository)
    public recordRepository: RecordRepository,
  ) { }

  @get('/records/{id}/client', {
    responses: {
      '200': {
        description: 'Client belonging to Record',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Client),
          },
        },
      },
    },
  })
  async getClient(
    @param.path.string('id') id: typeof Record.prototype.id,
  ): Promise<Client> {
    return this.recordRepository.client(id);
  }
}
