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
  Client,
  Dataset,
} from '../models';
import {ClientRepository} from '../repositories';

export class ClientDatasetController {
  constructor(
    @repository(ClientRepository) protected clientRepository: ClientRepository,
  ) { }

  @get('/clients/{id}/datasets', {
    responses: {
      '200': {
        description: 'Array of Client has many Dataset',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Dataset)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Dataset>,
  ): Promise<Dataset[]> {
    return this.clientRepository.datasets(id).find(filter);
  }

  @post('/clients/{id}/datasets', {
    responses: {
      '200': {
        description: 'Client model instance',
        content: {'application/json': {schema: getModelSchemaRef(Dataset)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Client.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {
            title: 'NewDatasetInClient',
            exclude: ['name'],
            optional: ['clientId']
          }),
        },
      },
    }) dataset: Omit<Dataset, 'name'>,
  ): Promise<Dataset> {
    return this.clientRepository.datasets(id).create(dataset);
  }

  @patch('/clients/{id}/datasets', {
    responses: {
      '200': {
        description: 'Client.Dataset PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {partial: true}),
        },
      },
    })
    dataset: Partial<Dataset>,
    @param.query.object('where', getWhereSchemaFor(Dataset)) where?: Where<Dataset>,
  ): Promise<Count> {
    return this.clientRepository.datasets(id).patch(dataset, where);
  }

  @del('/clients/{id}/datasets', {
    responses: {
      '200': {
        description: 'Client.Dataset DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Dataset)) where?: Where<Dataset>,
  ): Promise<Count> {
    return this.clientRepository.datasets(id).delete(where);
  }
}
