import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {inject} from '@loopback/core';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  HttpErrors,
} from '@loopback/rest';
import {Dataset} from '../models';
import {DatasetRepository} from '../repositories';

export class DatasetController {
  constructor(
    @repository(DatasetRepository)
    public datasetRepository : DatasetRepository,
  ) {}

  @post('/datasets', {
    responses: {
      '200': {
        description: 'Dataset model instance',
        content: {'application/json': {schema: getModelSchemaRef(Dataset)}},
      },
    },
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {
            title: 'NewDataset',
            exclude: ['id'],
          }),
        },
      },
    })
    dataset: Omit<Dataset, 'id'>,
  ): Promise<Dataset> {
    return this.datasetRepository.create(dataset);
  }

  @get('/datasets/count', {
    responses: {
      '200': {
        description: 'Dataset model count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async count(
    @param.where(Dataset) where?: Where<Dataset>,
  ): Promise<Count> {
    return this.datasetRepository.count(where);
  }

  @get('/datasets', {
    responses: {
      '200': {
        description: 'Array of Dataset model instances',
        content: {
          'application/json': {
            schema: {
              type: 'array',
              items: getModelSchemaRef(Dataset, {includeRelations: true}),
            },
          },
        },
      },
    },
  })
  async find(
    @param.filter(Dataset) filter?: Filter<Dataset>,
  ): Promise<Dataset[]> {
    return this.datasetRepository.find(filter);
  }

  @patch('/datasets', {
    responses: {
      '200': {
        description: 'Dataset PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {partial: true}),
        },
      },
    })
    dataset: Dataset,
    @param.where(Dataset) where?: Where<Dataset>,
  ): Promise<Count> {
    return this.datasetRepository.updateAll(dataset, where);
  }

  @get('/datasets/{id}', {
    responses: {
      '200': {
        description: 'Dataset model instance',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Dataset, {includeRelations: true}),
          },
        },
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Dataset, {exclude: 'where'}) filter?: FilterExcludingWhere<Dataset>
  ): Promise<Dataset> {
    return this.datasetRepository.findById(id, filter);
  }

  @patch('/datasets/{id}', {
    responses: {
      '204': {
        description: 'Dataset PATCH success',
      },
    },
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {partial: true}),
        },
      },
    })
    dataset: Dataset,
  ): Promise<void> {
    await this.datasetRepository.updateById(id, dataset);
  }

  @put('/datasets/{id}', {
    responses: {
      '204': {
        description: 'Dataset PUT success',
      },
    },
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() dataset: Dataset,
  ): Promise<void> {
    await this.datasetRepository.replaceById(id, dataset);
  }

  @del('/datasets/{id}', {
    responses: {
      '204': {
        description: 'Dataset DELETE success',
      },
    },
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.datasetRepository.deleteById(id);
  }
}
