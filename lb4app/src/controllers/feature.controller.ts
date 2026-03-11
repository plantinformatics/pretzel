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
  Request,
  RestBindings,
  HttpErrors,
} from '@loopback/rest';
import {inject} from '@loopback/core';
import {Feature} from '../models';
import {FeatureRepository} from '../repositories';
import {Lb3ModelWrap} from '../utils/lb3-model-wrap';
import {Lb3ModelWrapFactory} from '../utils/lb3-model-wrap.provider';

// @ts-ignore
const FeatureModule = require('../../lb3app/common/models/feature');

export class FeatureController {
  private lb3: Lb3ModelWrap;

  constructor(
    @repository(FeatureRepository)
    public featureRepository : FeatureRepository,
    @inject('utils.Lb3ModelWrap') private lb3WrapFactory: Lb3ModelWrapFactory,
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
    await this.requireAuth();
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.featureRepository.count(where);
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
    await this.requireAuth();
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.featureRepository.updateAll(feature, where);
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
    this.ensureLb3();
    await this.lb3.authUtils.authorizeFeatureRead(id, this.featureRepository);
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
    this.ensureLb3();
    await this.lb3.authUtils.authorizeFeatureWrite(id, this.featureRepository);
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
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // await this.featureRepository.replaceById(id, feature);
  }

  @del('/features/{id}')
  @response(204, {
    description: 'Feature DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    this.ensureLb3();
    await this.lb3.authUtils.authorizeFeatureWrite(id, this.featureRepository);
    await this.featureRepository.deleteById(id);
  }

  //----------------------------------------------------------------------------

  @get('/Features/search', {
    responses: {
      '200': {
        description: 'Returns features and their datasets given an array of feature names',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async search(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @param.query.string('blockId') blockId?: string,
    @param.query.boolean('matchRegExp') matchRegExp?: boolean,
  ): Promise<object[]> {
    await this.requireAuth();
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const filter = this.normalizeStringArray((req.query as any).filter);
    if (!filter.length) {
      throw new HttpErrors.BadRequest('filter query param must be a non-empty array');
    }
    const accessToken = this.lb3.authUtils.getAccessToken();
    const options = {accessToken};
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.search(blockId, filter, !!matchRegExp, options, cb);
    });
  }

  @post('/Features/searchPost', {
    responses: {
      '200': {
        description: 'Returns features and their datasets given an array of feature names',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async searchPost(
    @requestBody() data: object,
  ): Promise<object[]> {
    await this.requireAuth();
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const {blockId, filter, matchRegExp} = data as {
      blockId?: string;
      filter?: string[] | string;
      matchRegExp?: boolean;
    };
    const normalized = this.normalizeStringArray(filter);
    if (!normalized.length) {
      throw new HttpErrors.BadRequest('filter must be a non-empty array');
    }
    const accessToken = this.lb3.authUtils.getAccessToken();
    const options = {accessToken};
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.searchPost(blockId, normalized, !!matchRegExp, options, cb);
    });
  }

  @get('/Features/aliasSearch', {
    responses: {
      '200': {
        description: 'Given an array of feature names, returns matching aliases and features matching the aliases',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async aliasSearch(
    @inject(RestBindings.Http.REQUEST) req: Request,
  ): Promise<object> {
    await this.requireAuth();
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const featureNames = this.normalizeStringArray((req.query as any).featureNames);
    if (!featureNames.length) {
      throw new HttpErrors.BadRequest('featureNames query param must be a non-empty array');
    }
    const accessToken = this.lb3.authUtils.getAccessToken();
    const options = {accessToken};
    return this.lb3.lb3Call<object>(cb => {
      // @ts-ignore
      this.lb3.model.aliasSearch(featureNames, options, cb);
    });
  }

  @get('/Features/depthSearch', {
    responses: {
      '200': {
        description: 'Returns features by their level in the feature hierarchy',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async depthSearch(
    @param.query.string('blockId') blockId: string,
    @param.query.number('depth') depth: number,
  ): Promise<object[]> {
    await this.requireAuth();
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    if (!blockId) {
      throw new HttpErrors.BadRequest('blockId query param is required');
    }
    if (Number.isNaN(depth) || depth === undefined || depth === null) {
      throw new HttpErrors.BadRequest('depth query param is required');
    }
    const accessToken = this.lb3.authUtils.getAccessToken();
    const options = {accessToken};
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.depthSearch(blockId, depth, options, cb);
    });
  }

  @post('/Features/dnaSequenceSearch', {
    responses: {
      '200': {
        description: 'DNA Sequence Search e.g. Blast, returns TSV output as text array',
        content: {'application/json': {schema: {type: 'array', items: {type: 'string'}}}},
      },
    },
  })
  async dnaSequenceSearch(
    @requestBody() data: object,
  ): Promise<string[]> {
    await this.requireAuth();
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const accessToken = this.lb3.authUtils.getAccessToken();
    const options = {accessToken};
    return this.lb3.lb3Call<string[]>(cb => {
      // @ts-ignore
      this.lb3.model.dnaSequenceSearch(data, options, cb);
    });
  }

  private ensureLb3() {
    if (!this.lb3) {
      this.lb3 = this.lb3WrapFactory(FeatureModule);
    }
  }

  private async requireAuth(): Promise<void> {
    this.ensureLb3();
    await this.lb3.authUtils.requireClientId();
  }

  /** Accept 2 simpler formats for string array params filter and featureNames.
   *
   * Notes
   * For GET endpoints, array params are accepted as:
   * filter[]=A&filter[]=B
   * filter=["A","B"]
   * filter=A,B
   * Same for featureNames.
   */
  private normalizeStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(v => String(v));
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return [];
      }
      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed) ? parsed.map(v => String(v)) : [];
        } catch {
          return [trimmed];
        }
      }
      if (trimmed.includes(',')) {
        return trimmed.split(',').map(v => v.trim()).filter(Boolean);
      }
      return [trimmed];
    }
    return [];
  }
}
