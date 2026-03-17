import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
  HttpErrors,
} from '@loopback/rest';
import {
  Interval,
  Block,
} from '../models';
import {IntervalRepository} from '../repositories';

export class IntervalBlockController {
  constructor(
    @repository(IntervalRepository)
    public intervalRepository: IntervalRepository,
  ) { }

  @get('/intervals/{id}/block', {
    responses: {
      '200': {
        description: 'Block belonging to Interval',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Block),
          },
        },
      },
    },
  })
  async getBlock(
    @param.path.string('id') id: typeof Interval.prototype.id,
  ): Promise<Block> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.intervalRepository.block(id);
  }
}
