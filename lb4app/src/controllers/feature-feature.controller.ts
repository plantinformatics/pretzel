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
  Feature,
} from '../models';
import {FeatureRepository} from '../repositories';

export class FeatureFeatureController {
  constructor(
    /** generated as public for first relation : feature */
    @repository(FeatureRepository) protected featureRepository: FeatureRepository,
  ) { }

  @get('/features/{id}/feature', {
    responses: {
      '200': {
        description: 'Feature belonging to Feature',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Feature),
          },
        },
      },
    },
  })
  async getFeature(
    @param.path.string('id') id: typeof Feature.prototype.id,
  ): Promise<Feature> {
    return this.featureRepository.parent(id);
  }


  @get('/features/{id}/features', {
    responses: {
      '200': {
        description: 'Array of Feature has many Feature',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Feature)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Feature>,
  ): Promise<Feature[]> {
    return this.featureRepository.features(id).find(filter);
  }

  @post('/features/{id}/features', {
    responses: {
      '200': {
        description: 'Feature model instance',
        content: {'application/json': {schema: getModelSchemaRef(Feature)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Feature.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Feature, {
            title: 'NewFeatureInFeature',
            exclude: ['id'],
            optional: ['parentId']
          }),
        },
      },
    }) feature: Omit<Feature, 'id'>,
  ): Promise<Feature> {
    return this.featureRepository.features(id).create(feature);
  }

  @patch('/features/{id}/features', {
    responses: {
      '200': {
        description: 'Feature.Feature PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Feature, {partial: true}),
        },
      },
    })
    feature: Partial<Feature>,
    @param.query.object('where', getWhereSchemaFor(Feature)) where?: Where<Feature>,
  ): Promise<Count> {
    return this.featureRepository.features(id).patch(feature, where);
  }

  @del('/features/{id}/features', {
    responses: {
      '200': {
        description: 'Feature.Feature DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Feature)) where?: Where<Feature>,
  ): Promise<Count> {
    return this.featureRepository.features(id).delete(where);
  }
}
