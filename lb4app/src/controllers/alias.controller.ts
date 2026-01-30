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
import {Alias} from '../models';
import {AliasRepository} from '../repositories';

export class AliasController {
  constructor(
    @repository(AliasRepository)
    public aliasRepository : AliasRepository,
  ) {}

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
    return this.aliasRepository.count(where);
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
    return this.aliasRepository.updateAll(alias, where);
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
    await this.aliasRepository.replaceById(id, alias);
  }

  @del('/aliases/{id}')
  @response(204, {
    description: 'Alias DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.aliasRepository.deleteById(id);
  }
}
