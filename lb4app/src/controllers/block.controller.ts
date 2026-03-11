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
  Request, Response, RestBindings, HttpErrors,
} from '@loopback/rest';
import {inject} from '@loopback/core';

import {Block} from '../models';
import {BlockRepository} from '../repositories';
import {initSseResponse} from '../utils/sse';
import {Lb3ModelWrap} from '../utils/lb3-model-wrap';
import {Lb3ModelWrapFactory} from '../utils/lb3-model-wrap.provider';
// @ts-ignore
const {noCacheResult} = require('../../lb3app/common/utilities/remote-method');

// @ts-ignore
const BlockModule = require('../../lb3app/common/models/block');


export class BlockController {
  private lb3: Lb3ModelWrap;

  constructor(
    @repository(BlockRepository)
    public blockRepository : BlockRepository,
    @inject('utils.Lb3ModelWrap') private lb3WrapFactory: Lb3ModelWrapFactory,
  ) {
    this.lb3 = this.lb3WrapFactory(BlockModule);
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
    await this.requireAuth();
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.blockRepository.count(where);
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
    await this.requireAuth();
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.blockRepository.updateAll(block, where);
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
    await this.lb3.authUtils.authorizeBlocksRead([id]);
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
    await this.lb3.authUtils.authorizeBlockWrite(id);
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // await this.blockRepository.replaceById(id, block);
  }

  @del('/blocks/{id}')
  @response(204, {
    description: 'Block DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.lb3.authUtils.authorizeBlockWrite(id);
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
    await this.lb3.authUtils.authorizeBlocksRead([id]);

    this.lb3.bindLb3DataSource();
    const fnName = 'blockFeaturesInterval';
    // console.log(fnName, BlockClass.dataSource.connector);
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.blockFeaturesInterval(id, intervals, options, res, cb);
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
    await this.requireAuth();
    const blockId = (data as any)?.blockId;
    if (blockId) {
      await this.lb3.authUtils.authorizeBlocksRead([blockId]);
    } else {
      this.lb3.authUtils.enforceScopedBlockAccess();
    }
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<string>(cb => {
      // @ts-ignore
      this.lb3.model.blockFeaturesAdd(data, options, cb);
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
    await this.lb3.authUtils.authorizeBlocksRead(blocks ?? []);
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.blockFeaturesCount(blocks, options, res, cb);
    });
  }

  @get('/Blocks/blockFeaturesCounts', {
    responses: {
      '200': {
        description: "Returns an array of N bins of counts of the Features in the block",
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async blockFeaturesCounts(
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.query.string('id') id: string,
    @param.array('interval', 'query', {type: 'number'}) interval?: number[],
    @param.query.number('nBins') nBins?: number,
    @param.query.boolean('isZoomed') isZoomed?: boolean, // = false,
    @param.query.boolean('useBucketAuto') useBucketAuto?: boolean, // = false,
    @param.query.object('userOptions') userOptions?: object,
  ): Promise<object[]> {
    await this.lb3.authUtils.authorizeBlocksRead([id]);
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.blockFeaturesCounts(id, interval, nBins, isZoomed, useBucketAuto, userOptions, options, res, cb);
    });
  }

  @get('/Blocks/blocksFeaturesCountsStatus', {
    responses: {
      '200': {
        description: 'Returns an array of blocks with the status of their cached featuresCounts.',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async blocksFeaturesCountsStatus(
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.query.string('id') id?: string,
    @param.query.number('nBins') nBins?: number,
    @param.query.boolean('useBucketAuto') useBucketAuto?: boolean,
  ): Promise<object[]> {
    await this.requireAuth();
    noCacheResult(res);
    if (id) {
      await this.lb3.authUtils.authorizeBlocksRead([id]);
    } else {
      this.lb3.authUtils.enforceScopedBlockAccess();
    }
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.blocksFeaturesCountsStatus(id, nBins, useBucketAuto, options, res, cb);
    });
  }

  @get('/Blocks/blockFeaturesCountsStatus', {
    responses: {
      '200': {
        description: 'Returns status for cached feature counts in a block.',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async blockFeaturesCountsStatus(
    @param.query.string('id') id: string,
    @param.query.number('nBins') nBins?: number,
    @param.query.boolean('useBucketAuto') useBucketAuto?: boolean,
  ): Promise<unknown> {
    await this.lb3.authUtils.authorizeBlocksRead([id]);
    // @ts-ignore
    return this.lb3.model.blockFeaturesCountsStatus(id, nBins, useBucketAuto);
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
    await this.requireAuth();
    if (id) {
      await this.lb3.authUtils.authorizeBlocksRead([id]);
    } else {
      this.lb3.authUtils.enforceScopedBlockAccess();
    }
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.blockFeatureLimits(id, options, res, cb);
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
    await this.requireAuth();
    this.lb3.authUtils.enforceScopedBlockAccess();
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.blockValues(fieldName, options, res, cb);
    });
  }

  @get('/Blocks/paths', {
    responses: {
      '200': {
        description: 'Returns paths between the two blocks',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async paths(
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.array('id', 'query', {type: 'string'}) id: string[],
    @param.query.boolean('withDirect') withDirect?: boolean,
  ): Promise<object[]> {
    await this.lb3.authUtils.authorizeBlocksRead(id ?? []);
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.paths(id, withDirect, options, res, cb);
    });
  }

  @get('/Blocks/pathsProgressive', {
    responses: {
      '200': {
        description: 'Returns paths between the two blocks, in progressive steps',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async pathsProgressive(
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.array('id', 'query', {type: 'string'}) id: string[],
    @param.query.object('intervals') intervals: object,
  ): Promise<object[]> {
    await this.lb3.authUtils.authorizeBlocksRead(id ?? []);
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.pathsProgressive(id, intervals, options, res, cb);
    });
  }

  @get('/Blocks/pathsByReference', {
    responses: {
      '200': {
        description: 'Returns paths between blockA and blockB via reference blocks',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async pathsByReference(
    @param.array('id', 'query', {type: 'string'}) id: string[],
    @param.query.string('reference') reference: string,
    @param.query.number('max_distance') maxDistance: number,
  ): Promise<object[]> {
    await this.lb3.authUtils.authorizeBlocksRead(id ?? []);
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.pathsByReference(id, reference, maxDistance, options, cb);
    });
  }

  @get('/Blocks/pathsAliasesProgressive', {
    responses: {
      '200': {
        description: 'Returns paths from aliases between the two blocks, constrained by intervals',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async pathsAliasesProgressive(
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.array('id', 'query', {type: 'string'}) id: string[],
    @param.query.object('intervals') intervals: object,
  ): Promise<object[]> {
    await this.lb3.authUtils.authorizeBlocksRead(id ?? []);
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.pathsAliasesProgressive(id, intervals, options, res, cb);
    });
  }

  @get('/Blocks/pathsViaStream', {
    responses: {
      '200': {
        description: 'Streams paths between the two blocks',
        content: {'text/event-stream': {}},
      },
    },
  })
  async pathsViaStream(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.array('id', 'query', {type: 'string'}) id: string[],
    @param.query.object('intervals') intervals: object,
  ): Promise<Response> {
    await this.lb3.authUtils.authorizeBlocksRead(id ?? []);
    this.lb3.bindLb3DataSource();
    // Don't flush headers in initSseResponse() because sse.init() will send headers.
    initSseResponse(res);
    const options = null;
    console.log('headersSent before LB3:', res.headersSent);
    // @ts-ignore
    this.lb3.model.pathsViaStream(id, intervals, options, req, res, () => undefined);
    return res;
  }

  @get('/Blocks/pathsAliasesViaStream', {
    responses: {
      '200': {
        description: 'Streams paths from aliases between the two blocks',
        content: {'text/event-stream': {}},
      },
    },
  })
  async pathsAliasesViaStream(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.array('id', 'query', {type: 'string'}) id: string[],
    @param.query.object('intervals') intervals: object,
  ): Promise<Response> {
    await this.lb3.authUtils.authorizeBlocksRead(id ?? []);
    this.lb3.bindLb3DataSource();
    initSseResponse(res);
    const options = null;
    // @ts-ignore
    this.lb3.model.pathsAliasesViaStream(id, intervals, options, req, res, () => undefined);
    return res;
  }

  @get('/Blocks/syntenies', {
    responses: {
      '200': {
        description: 'Request syntenic blocks for left and right blocks',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async syntenies(
    @param.query.string('0') id0: string,
    @param.query.string('1') id1: string,
    @param.query.string('threshold-size') thresholdSize?: string,
    @param.query.string('threshold-continuity') thresholdContinuity?: string,
  ): Promise<object[]> {
    await this.lb3.authUtils.authorizeBlocksRead([id0, id1]);
    this.lb3.bindLb3DataSource();
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.syntenies(id0, id1, thresholdSize, thresholdContinuity, cb);
    });
  }

  @get('/Blocks/dnaSequenceLookup', {
    responses: {
      '200': {
        description: 'DNA Sequence Lookup',
        content: {'application/json': {schema: {type: 'string'}}},
      },
    },
  })
  async dnaSequenceLookup(
    @param.query.string('parent') parent: string,
    @param.query.string('region') region: string,
  ): Promise<string> {
    await this.lb3.authUtils.authorizeDatasetRead(parent);
    this.lb3.bindLb3DataSource();
    return this.lb3.lb3Call<string>(cb => {
      // @ts-ignore
      this.lb3.model.dnaSequenceLookup(parent, region, cb);
    });
  }

  @get('/Blocks/genotypeSamples', {
    responses: {
      '200': {
        description: 'VCF genotype Samples',
        content: {'application/json': {schema: {type: 'string'}}},
      },
    },
  })
  async genotypeSamples(
    @param.query.string('id') id: string,
    @param.query.string('datasetId') datasetId: string,
    @param.query.string('scope') scope: string,
    @param.query.object('filter') filter?: object,
  ): Promise<string> {
    await this.lb3.authUtils.authorizeBlocksRead([id]);
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<string>(cb => {
      // @ts-ignore
      this.lb3.model.genotypeSamples(id, datasetId, scope, filter, options, cb);
    });
  }

  @get('/Blocks/genotypeHaplotypesSamples', {
    responses: {
      '200': {
        description: 'VCF haplotype samples',
        content: {'application/json': {schema: {type: 'string'}}},
      },
    },
  })
  async genotypeHaplotypesSamples(
    @param.query.string('id') id: string,
    @param.query.string('datasetId') datasetId: string,
    @param.query.string('scope') scope: string,
    @param.array('positions', 'query', {type: 'string'}) positions: string[],
  ): Promise<string> {
    await this.lb3.authUtils.authorizeBlocksRead([id]);
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<string>(cb => {
      // @ts-ignore
      this.lb3.model.genotypeHaplotypesSamples(id, datasetId, scope, positions, options, cb);
    });
  }

  @get('/Blocks/vcfGenotypeLookup', {
    responses: {
      '200': {
        description: 'VCF genotype Lookup',
        content: {'application/json': {schema: {type: 'string'}}},
      },
    },
  })
  async vcfGenotypeLookup(
    @param.query.string('datasetId') datasetId: string,
    @param.query.string('scope') scope?: string,
    @param.query.object('preArgs') preArgs?: object,
    @param.query.number('nLines') nLines?: number,
  ): Promise<string> {
    await this.lb3.authUtils.authorizeDatasetRead(datasetId);
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<string>(cb => {
      // @ts-ignore
      this.lb3.model.vcfGenotypeLookup(datasetId, scope, preArgs, nLines, options, cb);
    });
  }

  @post('/Blocks/vcfGenotypeLookupPost', {
    responses: {
      '200': {
        description: 'VCF genotype Lookup (POST)',
        content: {'application/json': {schema: {type: 'string'}}},
      },
    },
  })
  async vcfGenotypeLookupPost(
    @requestBody() body: {
      datasetId: string;
      scope?: string;
      preArgs?: object;
      nLines?: number;
    },
  ): Promise<string> {
    await this.lb3.authUtils.authorizeDatasetRead(body.datasetId);
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<string>(cb => {
      // @ts-ignore
      this.lb3.model.vcfGenotypeLookupPost(body.datasetId, body.scope, body.preArgs, body.nLines, options, cb);
    });
  }

  @get('/Blocks/cacheClearKey', {
    responses: {
      '200': {
        description: 'Clear cached result for given cacheId and return the removed result.',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async cacheClearKey(
    @param.query.string('cacheId') cacheId: string,
  ): Promise<object> {
    await this.requireAuth();
    this.lb3.authUtils.enforceScopedBlockAccess();
    this.lb3.bindLb3DataSource();
    return this.lb3.lb3Call<object>(cb => {
      // @ts-ignore
      this.lb3.model.cacheClearKey(cacheId, cb);
    });
  }

  private async requireAuth(): Promise<void> {
    await this.lb3.authUtils.requireClientId();
  }

  //----------------------------------------------------------------------------
}
