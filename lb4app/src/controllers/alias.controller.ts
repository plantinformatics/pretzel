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
  Response,
  RestBindings,
  HttpErrors,
} from '@loopback/rest';
import {inject} from '@loopback/core';
import {Alias} from '../models';
import {AliasRepository} from '../repositories';
import {Lb3ModelWrap} from '../utils/lb3-model-wrap';
import {Lb3ModelWrapFactory} from '../utils/lb3-model-wrap.provider';

// @ts-ignore
const AliasModule = require('../../lb3app/common/models/alias');

export class AliasController {
  private lb3: Lb3ModelWrap;

  constructor(
    @repository(AliasRepository)
    public aliasRepository : AliasRepository,
    @inject('utils.Lb3ModelWrap') private lb3WrapFactory: Lb3ModelWrapFactory,
  ) {
    this.lb3 = this.lb3WrapFactory(AliasModule);
  }

  @post('/aliases')
  @response(200, {
    description: 'Alias model instance',
    content: {'application/json': {schema: getModelSchemaRef(Alias)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Alias, {
            title: 'NewAlias',
            exclude: ['id'],
          }),
        },
      },
    })
    alias: Omit<Alias, 'id'>,
  ): Promise<Alias> {
    await this.requireAuth();
    return this.aliasRepository.create(alias);
  }

  @get('/aliases/count')
  @response(200, {
    description: 'Alias model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Alias) where?: Where<Alias>,
  ): Promise<Count> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.aliasRepository.count(where);
  }

  @get('/aliases')
  @response(200, {
    description: 'Array of Alias model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Alias, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Alias) filter?: Filter<Alias>,
  ): Promise<Alias[]> {
    await this.requireAuth();
    return this.aliasRepository.find(filter);
  }

  @patch('/aliases')
  @response(200, {
    description: 'Alias PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Alias, {partial: true}),
        },
      },
    })
    alias: Alias,
    @param.where(Alias) where?: Where<Alias>,
  ): Promise<Count> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.aliasRepository.updateAll(alias, where);
  }

  @get('/aliases/{id}')
  @response(200, {
    description: 'Alias model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Alias, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Alias, {exclude: 'where'}) filter?: FilterExcludingWhere<Alias>
  ): Promise<Alias> {
    await this.requireAuth();
    return this.aliasRepository.findById(id, filter);
  }

  @patch('/aliases/{id}')
  @response(204, {
    description: 'Alias PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Alias, {partial: true}),
        },
      },
    })
    alias: Alias,
  ): Promise<void> {
    await this.requireAuth();
    await this.aliasRepository.updateById(id, alias);
  }

  @put('/aliases/{id}')
  @response(204, {
    description: 'Alias PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() alias: Alias,
  ): Promise<void> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // await this.aliasRepository.replaceById(id, alias);
  }

  @del('/aliases/{id}')
  @response(204, {
    description: 'Alias DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.requireAuth();
    await this.aliasRepository.deleteById(id);
  }

  //----------------------------------------------------------------------------

  @post('/Aliases/bulkCreate', {
    responses: {
      '200': {
        description: 'Creates an array of aliases',
        content: {'application/json': {schema: {type: 'number'}}},
      },
    },
  })
  async bulkCreate(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @requestBody({
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'array',
            items: {type: 'object'},
          },
        },
      },
    })
    data: object[],
  ): Promise<number> {
    await this.requireAuth();
    this.lb3.bindLb3DataSource();
    const options = {accessToken: this.lb3.authUtils.getAccessToken()};
    return this.lb3.lb3Call<number>(cb => {
      // @ts-ignore
      this.lb3.model.bulkCreate(data, options, req, cb);
    });
  }

  @get('/Aliases/namespacesAliases', {
    responses: {
      '200': {
        description: 'Returns aliases between the two namespaces',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async namespacesAliases(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.query.number('limit') limit?: number,
  ): Promise<object[]> {
    await this.requireAuth();
    const namespaces = this.normalizeStringArray((req.query as any).namespaces);
    if (namespaces.length < 2) {
      throw new HttpErrors.BadRequest('namespaces query param must contain two namespace values');
    }
    this.lb3.bindLb3DataSource();
    const options = {accessToken: this.lb3.authUtils.getAccessToken()};
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.namespacesAliases(namespaces.slice(0, 2), limit, options, res, cb);
    });
  }

  @get('/Aliases/stringSearch', {
    responses: {
      '200': {
        description: 'Returns aliases matching any of the given strings',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async stringSearch(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @inject(RestBindings.Http.RESPONSE) res: Response,
  ): Promise<object[]> {
    await this.requireAuth();
    const strings = this.normalizeStringArray((req.query as any).strings);
    if (!strings.length) {
      throw new HttpErrors.BadRequest('strings query param must be a non-empty array');
    }
    this.lb3.bindLb3DataSource();
    const options = {accessToken: this.lb3.authUtils.getAccessToken()};
    const cursor = await this.lb3.lb3CallNoCb<any>(() => {
      // @ts-ignore
      return this.lb3.model.stringSearch(strings, options, res);
    });
    return cursor.toArray();
  }

  @get('/Aliases/cacheClear', {
    responses: {
      '200': {
        description: 'Clear cached copies of aliases from a secondary Pretzel API server.',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async cacheClear(
    @param.query.number('time') time: number,
  ): Promise<object> {
    await this.requireAuth();
    this.lb3.bindLb3DataSource();
    const options = {accessToken: this.lb3.authUtils.getAccessToken()};
    return this.lb3.lb3Call<object>(cb => {
      // @ts-ignore
      this.lb3.model.cacheClear(time, options, cb);
    });
  }

  @get('/Aliases/cacheClearRequests', {
    responses: {
      '200': {
        description: 'Clear cached copies of aliases and clear request promises.',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async cacheClearRequests(
    @param.query.number('time') time: number,
  ): Promise<object[]> {
    await this.requireAuth();
    this.lb3.bindLb3DataSource();
    const options = {accessToken: this.lb3.authUtils.getAccessToken()};
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.cacheClearRequests(time, options, cb);
    });
  }

  private async requireAuth(): Promise<void> {
    await this.lb3.authUtils.requireClientId();
  }

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
