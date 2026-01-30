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
import {Feature} from '../models';
import {FeatureRepository} from '../repositories';

export class FeatureController {
  constructor(
    @repository(FeatureRepository)
    public featureRepository : FeatureRepository,
  ) {}

  @post('/features')
  @response(200, {
    description: 'Feature model instance',
    content: {'application/json': {schema: getModelSchemaRef(Feature)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Feature, {
            title: 'NewFeature',
            exclude: ['id'],
          }),
        },
      },
    })
    feature: Omit<Feature, 'id'>,
  ): Promise<Feature> {
    return this.featureRepository.create(feature);
  }

  @get('/features/count')
  @response(200, {
    description: 'Feature model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Feature) where?: Where<Feature>,
  ): Promise<Count> {
    return this.featureRepository.count(where);
  }

  @get('/features')
  @response(200, {
    description: 'Array of Feature model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Feature, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Feature) filter?: Filter<Feature>,
  ): Promise<Feature[]> {
    return this.featureRepository.find(filter);
  }

  @patch('/features')
  @response(200, {
    description: 'Feature PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Feature, {partial: true}),
        },
      },
    })
    feature: Feature,
    @param.where(Feature) where?: Where<Feature>,
  ): Promise<Count> {
    return this.featureRepository.updateAll(feature, where);
  }

  @get('/features/{id}')
  @response(200, {
    description: 'Feature model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Feature, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Feature, {exclude: 'where'}) filter?: FilterExcludingWhere<Feature>
  ): Promise<Feature> {
    return this.featureRepository.findById(id, filter);
  }

  @patch('/features/{id}')
  @response(204, {
    description: 'Feature PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Feature, {partial: true}),
        },
      },
    })
    feature: Feature,
  ): Promise<void> {
    await this.featureRepository.updateById(id, feature);
  }

  @put('/features/{id}')
  @response(204, {
    description: 'Feature PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() feature: Feature,
  ): Promise<void> {
    await this.featureRepository.replaceById(id, feature);
  }

  @del('/features/{id}')
  @response(204, {
    description: 'Feature DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.featureRepository.deleteById(id);
  }
}
