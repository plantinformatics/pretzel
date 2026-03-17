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
import {Interval} from '../models';
import {IntervalRepository} from '../repositories';
import {Lb3ModelWrap} from '../utils/lb3-model-wrap';
import {Lb3ModelWrapFactory} from '../utils/lb3-model-wrap.provider';

const NoopLb3Module = (_modelClass: any) => {};

export class IntervalController {
  private lb3: Lb3ModelWrap;

  constructor(
    @repository(IntervalRepository)
    public intervalRepository : IntervalRepository,
    @inject('utils.Lb3ModelWrap') private lb3WrapFactory: Lb3ModelWrapFactory,
  ) {
    this.lb3 = this.lb3WrapFactory(NoopLb3Module);
  }

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
    await this.requireAuth();
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.intervalRepository.count(where);
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
    await this.requireAuth();
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.intervalRepository.updateAll(interval, where);
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
    await this.requireAuth();
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
    await this.requireAuth();
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // await this.intervalRepository.replaceById(id, interval);
  }

  @del('/intervals/{id}')
  @response(204, {
    description: 'Interval DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.requireAuth();
    await this.intervalRepository.deleteById(id);
  }

  private async requireAuth(): Promise<void> {
    await this.lb3.authUtils.requireClientId();
  }
}
