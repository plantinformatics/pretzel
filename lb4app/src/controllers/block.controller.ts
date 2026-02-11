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
  RequestContext, Response, RestBindings,
} from '@loopback/rest';
import {inject} from '@loopback/core';
import {MongoDsDataSource} from '../datasources';


import {Block} from '../models';
import {BlockRepository} from '../repositories';
// @ts-ignore
const BlockModule = require('../../lb3app/common/models/block')
class BlockClass {
  static remoteMethod() {}
  static observe() {}
  static afterRemote() {}
  static dataSource = {connector : null};
}
BlockModule(BlockClass);

export class BlockController {
  constructor(
    @inject(RestBindings.Http.CONTEXT) private ctx: RequestContext,
    @inject('datasources.mongoDs') private mongoDs: MongoDsDataSource,

    @repository(BlockRepository)
    public blockRepository : BlockRepository,
  ) {}

  private bindLb3DataSource() {
    const connector = this.mongoDs.connector as any;
    BlockClass.dataSource.connector = connector.db ?? connector;
  }

  private lb3Call<T>(invoke: (cb: (error: unknown, result: T) => void) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      function cb(error: unknown, result: T) {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
      invoke(cb);
    });
  }

  @post('/blocks')
  @response(200, {
    description: 'Block model instance',
    content: {'application/json': {schema: getModelSchemaRef(Block)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Block, {
            title: 'NewBlock',
            exclude: ['id'],
          }),
        },
      },
    })
    block: Omit<Block, 'id'>,
  ): Promise<Block> {
    return this.blockRepository.create(block);
  }

  @get('/blocks/count')
  @response(200, {
    description: 'Block model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Block) where?: Where<Block>,
  ): Promise<Count> {
    return this.blockRepository.count(where);
  }

  @get('/blocks')
  @response(200, {
    description: 'Array of Block model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Block, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Block) filter?: Filter<Block>,
  ): Promise<Block[]> {
    return this.blockRepository.find(filter);
  }

  @patch('/blocks')
  @response(200, {
    description: 'Block PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Block, {partial: true}),
        },
      },
    })
    block: Block,
    @param.where(Block) where?: Where<Block>,
  ): Promise<Count> {
    return this.blockRepository.updateAll(block, where);
  }

  @get('/blocks/{id}')
  @response(200, {
    description: 'Block model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Block, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Block, {exclude: 'where'}) filter?: FilterExcludingWhere<Block>
  ): Promise<Block> {
    return this.blockRepository.findById(id, filter);
  }

  @patch('/blocks/{id}')
  @response(204, {
    description: 'Block PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Block, {partial: true}),
        },
      },
    })
    block: Block,
  ): Promise<void> {
    await this.blockRepository.updateById(id, block);
  }

  @put('/blocks/{id}')
  @response(204, {
    description: 'Block PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() block: Block,
  ): Promise<void> {
    await this.blockRepository.replaceById(id, block);
  }

  @del('/blocks/{id}')
  @response(204, {
    description: 'Block DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.blockRepository.deleteById(id);
  }

  //----------------------------------------------------------------------------

  @get('/Blocks/blockFeaturesInterval', {
    responses: {
      '200': {
	description: 'Returns Features of the block, within the interval optionally given in parameters, and filtering also for range / resolution',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async blockFeaturesInterval(
    @inject(RestBindings.Http.RESPONSE) res: Response,

    @param.query.string('id') id: string,
    @param.query.object('intervals') intervals: object,
  ): Promise<object[]> {

    const req = this.ctx.request;

    this.bindLb3DataSource();
    const fnName = 'blockFeaturesInterval';
    // console.log(fnName, BlockClass.dataSource.connector);
    const options = null;
    return this.lb3Call<object[]>(cb => {
      // @ts-ignore
      BlockClass.blockFeaturesInterval(id, intervals, options, res, cb);
    });
  }

  @post('/Blocks/blockFeaturesAdd', {
    responses: {
      '200': {
        description: 'Append the features in data to the given block',
        content: {'application/json': {schema: {type: 'string'}}},
      },
    },
  })
  async blockFeaturesAdd(
    @requestBody() data: object,
  ): Promise<string> {
    this.bindLb3DataSource();
    const options = null;
    return this.lb3Call<string>(cb => {
      // @ts-ignore
      BlockClass.blockFeaturesAdd(data, options, cb);
    });
  }

  @get('/Blocks/blockFeaturesCount', {
    responses: {
      '200': {
        description: 'Return a count of the Features in each block',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async blockFeaturesCount(
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.array('blocks', 'query', {type: 'string'})
    blocks: string[],
  ): Promise<object[]> {
    this.bindLb3DataSource();
    const options = null;
    return this.lb3Call<object[]>(cb => {
      // @ts-ignore
      BlockClass.blockFeaturesCount(blocks, options, res, cb);
    });
  }

  @get('/Blocks/blockFeatureLimits', {
    responses: {
      '200': {
        description: 'Returns an array of blocks with their min&max Feature values.',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async blockFeatureLimits(
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.query.string('id') id?: string,
  ): Promise<object[]> {
    this.bindLb3DataSource();
    const options = null;
    return this.lb3Call<object[]>(cb => {
      // @ts-ignore
      BlockClass.blockFeatureLimits(id, options, res, cb);
    });
  }

  @get('/Blocks/blockValues', {
    responses: {
      '200': {
        description: 'Returns an array of blocks of QTL datasets, with their Feature Trait values.',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async blockValues(
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.query.string('fieldName') fieldName: string,
  ): Promise<object[]> {
    this.bindLb3DataSource();
    const options = null;
    return this.lb3Call<object[]>(cb => {
      // @ts-ignore
      BlockClass.blockValues(fieldName, options, res, cb);
    });
  }



  //----------------------------------------------------------------------------
}
