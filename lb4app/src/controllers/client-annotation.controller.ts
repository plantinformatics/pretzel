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
  Annotation,
} from '../models';
import {ClientRepository} from '../repositories';

export class ClientAnnotationController {
  constructor(
    @repository(ClientRepository) protected clientRepository: ClientRepository,
  ) { }

  @get('/clients/{id}/annotations', {
    responses: {
      '200': {
        description: 'Array of Client has many Annotation',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Annotation)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Annotation>,
  ): Promise<Annotation[]> {
    return this.clientRepository.annotations(id).find(filter);
  }

  @post('/clients/{id}/annotations', {
    responses: {
      '200': {
        description: 'Client model instance',
        content: {'application/json': {schema: getModelSchemaRef(Annotation)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Client.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Annotation, {
            title: 'NewAnnotationInClient',
            exclude: ['id'],
            optional: ['clientId']
          }),
        },
      },
    }) annotation: Omit<Annotation, 'id'>,
  ): Promise<Annotation> {
    return this.clientRepository.annotations(id).create(annotation);
  }

  @patch('/clients/{id}/annotations', {
    responses: {
      '200': {
        description: 'Client.Annotation PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Annotation, {partial: true}),
        },
      },
    })
    annotation: Partial<Annotation>,
    @param.query.object('where', getWhereSchemaFor(Annotation)) where?: Where<Annotation>,
  ): Promise<Count> {
    return this.clientRepository.annotations(id).patch(annotation, where);
  }

  @del('/clients/{id}/annotations', {
    responses: {
      '200': {
        description: 'Client.Annotation DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Annotation)) where?: Where<Annotation>,
  ): Promise<Count> {
    return this.clientRepository.annotations(id).delete(where);
  }
}
