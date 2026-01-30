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
  Interval,
} from '../models';
import {BlockRepository} from '../repositories';

export class BlockIntervalController {
  constructor(
    @repository(BlockRepository) protected blockRepository: BlockRepository,
  ) { }

  @get('/blocks/{id}/intervals', {
    responses: {
      '200': {
        description: 'Array of Block has many Interval',
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
    return this.blockRepository.intervals(id).find(filter);
  }

  @post('/blocks/{id}/intervals', {
    responses: {
      '200': {
        description: 'Block model instance',
        content: {'application/json': {schema: getModelSchemaRef(Interval)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Block.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Interval, {
            title: 'NewIntervalInBlock',
            exclude: ['id'],
            optional: ['blockId']
          }),
        },
      },
    }) interval: Omit<Interval, 'id'>,
  ): Promise<Interval> {
    return this.blockRepository.intervals(id).create(interval);
  }

  @patch('/blocks/{id}/intervals', {
    responses: {
      '200': {
        description: 'Block.Interval PATCH success count',
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
    return this.blockRepository.intervals(id).patch(interval, where);
  }

  @del('/blocks/{id}/intervals', {
    responses: {
      '200': {
        description: 'Block.Interval DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Interval)) where?: Where<Interval>,
  ): Promise<Count> {
    return this.blockRepository.intervals(id).delete(where);
  }
}
