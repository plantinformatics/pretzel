import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Dataset,
  Group,
} from '../models';
import {DatasetRepository} from '../repositories';

export class DatasetGroupController {
  constructor(
    @repository(DatasetRepository)
    public datasetRepository: DatasetRepository,
  ) { }

  @get('/datasets/{id}/group', {
    responses: {
      '200': {
        description: 'Group belonging to Dataset',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Group),
          },
        },
      },
    },
  })
  async getGroup(
    @param.path.string('id') id: typeof Dataset.prototype.name,
  ): Promise<Group> {
    return this.datasetRepository.group(id);
  }
}
