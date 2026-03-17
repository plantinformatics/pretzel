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
  HttpErrors,
} from '@loopback/rest';
import {inject} from '@loopback/core';
import {Annotation} from '../models';
import {AnnotationRepository} from '../repositories';
import {Lb3ModelWrap} from '../utils/lb3-model-wrap';
import {Lb3ModelWrapFactory} from '../utils/lb3-model-wrap.provider';

const NoopLb3Module = (_modelClass: any) => {};

export class AnnotationController {
  private lb3: Lb3ModelWrap;

  constructor(
    @repository(AnnotationRepository)
    public annotationRepository : AnnotationRepository,
    @inject('utils.Lb3ModelWrap') private lb3WrapFactory: Lb3ModelWrapFactory,
  ) {
    this.lb3 = this.lb3WrapFactory(NoopLb3Module);
  }

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
    await this.requireAuth();
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.annotationRepository.count(where);
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
    await this.requireAuth();
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.annotationRepository.updateAll(annotation, where);
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
    await this.requireAuth();
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
    await this.requireAuth();
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // await this.annotationRepository.replaceById(id, annotation);
  }

  @del('/annotations/{id}')
  @response(204, {
    description: 'Annotation DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.requireAuth();
    await this.annotationRepository.deleteById(id);
  }

  private async requireAuth(): Promise<void> {
    await this.lb3.authUtils.requireClientId();
  }
}
