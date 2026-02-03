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
} from '../models';
import {DatasetRepository} from '../repositories';

export class DatasetDatasetController {
  constructor(
    @repository(DatasetRepository)
    public datasetRepository: DatasetRepository,
  ) { }

  @get('/datasets/{id}/dataset', {
    responses: {
      '200': {
        description: 'Dataset belonging to Dataset',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Dataset),
          },
        },
      },
    },
  })
  async getDataset(
    @param.path.string('id') id: typeof Dataset.prototype.name,
  ): Promise<Dataset> {
    return this.datasetRepository.parentId(id);
  }
}
