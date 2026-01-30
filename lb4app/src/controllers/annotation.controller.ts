import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
} from '@loopback/rest';
import {Annotation} from '../models';
import {AnnotationRepository} from '../repositories';

export class AnnotationController {
  constructor(
    @repository(AnnotationRepository)
    public annotationRepository : AnnotationRepository,
  ) {}

  @post('/annotations')
  @response(200, {
    description: 'Annotation model instance',
    content: {'application/json': {schema: getModelSchemaRef(Annotation)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Annotation, {
            title: 'NewAnnotation',
            exclude: ['id'],
          }),
        },
      },
    })
    annotation: Omit<Annotation, 'id'>,
  ): Promise<Annotation> {
    return this.annotationRepository.create(annotation);
  }

  @get('/annotations/count')
  @response(200, {
    description: 'Annotation model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Annotation) where?: Where<Annotation>,
  ): Promise<Count> {
    return this.annotationRepository.count(where);
  }

  @get('/annotations')
  @response(200, {
    description: 'Array of Annotation model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Annotation, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Annotation) filter?: Filter<Annotation>,
  ): Promise<Annotation[]> {
    return this.annotationRepository.find(filter);
  }

  @patch('/annotations')
  @response(200, {
    description: 'Annotation PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Annotation, {partial: true}),
        },
      },
    })
    annotation: Annotation,
    @param.where(Annotation) where?: Where<Annotation>,
  ): Promise<Count> {
    return this.annotationRepository.updateAll(annotation, where);
  }

  @get('/annotations/{id}')
  @response(200, {
    description: 'Annotation model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Annotation, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Annotation, {exclude: 'where'}) filter?: FilterExcludingWhere<Annotation>
  ): Promise<Annotation> {
    return this.annotationRepository.findById(id, filter);
  }

  @patch('/annotations/{id}')
  @response(204, {
    description: 'Annotation PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Annotation, {partial: true}),
        },
      },
    })
    annotation: Annotation,
  ): Promise<void> {
    await this.annotationRepository.updateById(id, annotation);
  }

  @put('/annotations/{id}')
  @response(204, {
    description: 'Annotation PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() annotation: Annotation,
  ): Promise<void> {
    await this.annotationRepository.replaceById(id, annotation);
  }

  @del('/annotations/{id}')
  @response(204, {
    description: 'Annotation DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.annotationRepository.deleteById(id);
  }
}
