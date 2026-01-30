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
import {Interval} from '../models';
import {IntervalRepository} from '../repositories';

export class IntervalController {
  constructor(
    @repository(IntervalRepository)
    public intervalRepository : IntervalRepository,
  ) {}

  @post('/intervals')
  @response(200, {
    description: 'Interval model instance',
    content: {'application/json': {schema: getModelSchemaRef(Interval)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Interval, {
            title: 'NewInterval',
            exclude: ['id'],
          }),
        },
      },
    })
    interval: Omit<Interval, 'id'>,
  ): Promise<Interval> {
    return this.intervalRepository.create(interval);
  }

  @get('/intervals/count')
  @response(200, {
    description: 'Interval model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Interval) where?: Where<Interval>,
  ): Promise<Count> {
    return this.intervalRepository.count(where);
  }

  @get('/intervals')
  @response(200, {
    description: 'Array of Interval model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Interval, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Interval) filter?: Filter<Interval>,
  ): Promise<Interval[]> {
    return this.intervalRepository.find(filter);
  }

  @patch('/intervals')
  @response(200, {
    description: 'Interval PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Interval, {partial: true}),
        },
      },
    })
    interval: Interval,
    @param.where(Interval) where?: Where<Interval>,
  ): Promise<Count> {
    return this.intervalRepository.updateAll(interval, where);
  }

  @get('/intervals/{id}')
  @response(200, {
    description: 'Interval model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Interval, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Interval, {exclude: 'where'}) filter?: FilterExcludingWhere<Interval>
  ): Promise<Interval> {
    return this.intervalRepository.findById(id, filter);
  }

  @patch('/intervals/{id}')
  @response(204, {
    description: 'Interval PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Interval, {partial: true}),
        },
      },
    })
    interval: Interval,
  ): Promise<void> {
    await this.intervalRepository.updateById(id, interval);
  }

  @put('/intervals/{id}')
  @response(204, {
    description: 'Interval PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() interval: Interval,
  ): Promise<void> {
    await this.intervalRepository.replaceById(id, interval);
  }

  @del('/intervals/{id}')
  @response(204, {
    description: 'Interval DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.intervalRepository.deleteById(id);
  }
}
