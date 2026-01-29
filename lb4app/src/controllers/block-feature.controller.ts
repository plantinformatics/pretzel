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
  Block,
  Feature,
} from '../models';
import {BlockRepository} from '../repositories';

export class BlockFeatureController {
  constructor(
    @repository(BlockRepository) protected blockRepository: BlockRepository,
  ) { }

  @get('/blocks/{id}/features', {
    responses: {
      '200': {
        description: 'Array of Block has many Feature',
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
    return this.blockRepository.features(id).find(filter);
  }

  @post('/blocks/{id}/features', {
    responses: {
      '200': {
        description: 'Block model instance',
        content: {'application/json': {schema: getModelSchemaRef(Feature)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Block.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Feature, {
            title: 'NewFeatureInBlock',
            exclude: ['id'],
            optional: ['blockId']
          }),
        },
      },
    }) feature: Omit<Feature, 'id'>,
  ): Promise<Feature> {
    return this.blockRepository.features(id).create(feature);
  }

  @patch('/blocks/{id}/features', {
    responses: {
      '200': {
        description: 'Block.Feature PATCH success count',
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
    return this.blockRepository.features(id).patch(feature, where);
  }

  @del('/blocks/{id}/features', {
    responses: {
      '200': {
        description: 'Block.Feature DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Feature)) where?: Where<Feature>,
  ): Promise<Count> {
    return this.blockRepository.features(id).delete(where);
  }
}
