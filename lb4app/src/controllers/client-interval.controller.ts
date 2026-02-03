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
  Interval,
} from '../models';
import {ClientRepository} from '../repositories';

export class ClientIntervalController {
  constructor(
    @repository(ClientRepository) protected clientRepository: ClientRepository,
  ) { }

  @get('/clients/{id}/intervals', {
    responses: {
      '200': {
        description: 'Array of Client has many Interval',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Interval)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Interval>,
  ): Promise<Interval[]> {
    return this.clientRepository.intervals(id).find(filter);
  }

  @post('/clients/{id}/intervals', {
    responses: {
      '200': {
        description: 'Client model instance',
        content: {'application/json': {schema: getModelSchemaRef(Interval)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Client.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Interval, {
            title: 'NewIntervalInClient',
            exclude: ['id'],
            optional: ['clientId']
          }),
        },
      },
    }) interval: Omit<Interval, 'id'>,
  ): Promise<Interval> {
    return this.clientRepository.intervals(id).create(interval);
  }

  @patch('/clients/{id}/intervals', {
    responses: {
      '200': {
        description: 'Client.Interval PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Interval, {partial: true}),
        },
      },
    })
    interval: Partial<Interval>,
    @param.query.object('where', getWhereSchemaFor(Interval)) where?: Where<Interval>,
  ): Promise<Count> {
    return this.clientRepository.intervals(id).patch(interval, where);
  }

  @del('/clients/{id}/intervals', {
    responses: {
      '200': {
        description: 'Client.Interval DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Interval)) where?: Where<Interval>,
  ): Promise<Count> {
    return this.clientRepository.intervals(id).delete(where);
  }
}
