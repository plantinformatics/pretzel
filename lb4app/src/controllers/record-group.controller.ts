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
  Group,
} from '../models';
import {RecordRepository} from '../repositories';

export class RecordGroupController {
  constructor(
    @repository(RecordRepository)
    public recordRepository: RecordRepository,
  ) { }

  @get('/records/{id}/group', {
    responses: {
      '200': {
        description: 'Group belonging to Record',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Group),
          },
        },
      },
    },
  })
  async getGroup(
    @param.path.string('id') id: typeof Record.prototype.id,
  ): Promise<Group> {
    return this.recordRepository.group(id);
  }
}
