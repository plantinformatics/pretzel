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
import {ClientGroup} from '../models';
import {ClientGroupRepository} from '../repositories';
import {Lb3ModelWrap} from '../utils/lb3-model-wrap';
import {Lb3ModelWrapFactory} from '../utils/lb3-model-wrap.provider';

// @ts-ignore
const ClientGroupModule = require('../../lb3app/common/models/clientGroup');

type ClientGroupAddEmailBody = {
  groupId: string;
  clientEmail: string;
};

type Lb3UserId = {
  toHexString(): string;
  toString(): string;
};

type Lb3AccessToken = {
  userId: Lb3UserId;
};

type Lb3Options = {
  accessToken: Lb3AccessToken;
};

export class ClientGroupController {
  private lb3: Lb3ModelWrap;

  constructor(
    @repository(ClientGroupRepository)
    public clientGroupRepository : ClientGroupRepository,
    @inject('utils.Lb3ModelWrap') private lb3WrapFactory: Lb3ModelWrapFactory,
  ) {
    this.lb3 = this.lb3WrapFactory(ClientGroupModule);
  }

  @post('/client-groups')
  @response(200, {
    description: 'ClientGroup model instance',
    content: {'application/json': {schema: getModelSchemaRef(ClientGroup)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ClientGroup, {
            title: 'NewClientGroup',
            exclude: ['id'],
          }),
        },
      },
    })
    clientGroup: Omit<ClientGroup, 'id'>,
  ): Promise<ClientGroup> {
    await this.requireAuth();
    return this.clientGroupRepository.create(clientGroup);
  }

  @get('/client-groups/count')
  @response(200, {
    description: 'ClientGroup model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(ClientGroup) where?: Where<ClientGroup>,
  ): Promise<Count> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.clientGroupRepository.count(where);
  }

  @get('/client-groups')
  @response(200, {
    description: 'Array of ClientGroup model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(ClientGroup, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(ClientGroup) filter?: Filter<ClientGroup>,
  ): Promise<ClientGroup[]> {
    const clientId = await this.requireAuth();
    if (!clientId) {
      return this.clientGroupRepository.find(filter);
    }
    const groupIds = await this.lb3.authUtils.getClientGroupIds(clientId);
    const accessOr: Where<ClientGroup>[] = [{clientId}];
    if (groupIds.size) {
      accessOr.push({groupId: {inq: [...groupIds]}});
    }
    const accessibleWhere: Where<ClientGroup> = {
      or: accessOr,
    };
    const mergedWhere = filter?.where
      ? {and: [accessibleWhere, filter.where]} as Where<ClientGroup>
      : accessibleWhere;
    return this.clientGroupRepository.find({...filter, where: mergedWhere});
  }

  @patch('/client-groups')
  @response(200, {
    description: 'ClientGroup PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ClientGroup, {partial: true}),
        },
      },
    })
    clientGroup: ClientGroup,
    @param.where(ClientGroup) where?: Where<ClientGroup>,
  ): Promise<Count> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.clientGroupRepository.updateAll(clientGroup, where);
  }

  @get('/client-groups/{id}')
  @response(200, {
    description: 'ClientGroup model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(ClientGroup, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(ClientGroup, {exclude: 'where'}) filter?: FilterExcludingWhere<ClientGroup>
  ): Promise<ClientGroup> {
    await this.authorizeClientGroupRead(id);
    return this.clientGroupRepository.findById(id, filter);
  }

  @patch('/client-groups/{id}')
  @response(204, {
    description: 'ClientGroup PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(ClientGroup, {partial: true}),
        },
      },
    })
    clientGroup: ClientGroup,
  ): Promise<void> {
    await this.authorizeClientGroupWrite(id);
    await this.clientGroupRepository.updateById(id, clientGroup);
  }

  @put('/client-groups/{id}')
  @response(204, {
    description: 'ClientGroup PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() clientGroup: ClientGroup,
  ): Promise<void> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // await this.clientGroupRepository.replaceById(id, clientGroup);
  }

  @del('/client-groups/{id}')
  @response(204, {
    description: 'ClientGroup DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.requireAuth();
    await this.clientGroupRepository.deleteById(id, await this.buildLb3Options());
  }

  //-----------------------------------------------------------------------------

  @post('/ClientGroups/addEmail', {
    responses: {
      '200': {
        description: 'Add user email to group, i.e. create a ClientGroup',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async addEmail(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['groupId', 'clientEmail'],
            properties: {
              groupId: {type: 'string'},
              clientEmail: {type: 'string'},
            },
          },
        },
      },
    })
    body: ClientGroupAddEmailBody,
  ): Promise<object> {
    const {groupId, clientEmail} = body ?? {};
    if (!groupId || !clientEmail) {
      throw new HttpErrors.BadRequest('groupId and clientEmail are required');
    }
    const options = await this.buildLb3Options();
    this.lb3.bindLb3DataSource();
    return this.lb3.lb3Call<object>(cb => {
      // @ts-ignore
      this.lb3.model.addEmail(groupId, clientEmail, options, cb);
    });
  }

  private async requireAuth(): Promise<string | undefined> {
    return this.lb3.authUtils.requireClientId();
  }

  private async authorizeClientGroupRead(id: string): Promise<void> {
    const clientId = await this.requireAuth();
    if (!clientId) return;
    const clientGroup = await this.clientGroupRepository.findById(id);
    if (clientGroup.clientId?.toString() === clientId) {
      return;
    }
    const groupId = clientGroup.groupId?.toString();
    if (!groupId) {
      throw new HttpErrors.Forbidden('Not authorized for client-group read');
    }
    const groupIds = await this.lb3.authUtils.getClientGroupIds(clientId);
    if (groupIds.has(groupId)) {
      return;
    }
    throw new HttpErrors.Forbidden('Not authorized for client-group read');
  }

  private async authorizeClientGroupWrite(id: string): Promise<void> {
    const clientId = await this.requireAuth();
    if (!clientId) return;
    const clientGroup = await this.clientGroupRepository.findById(id);
    if (clientGroup.clientId?.toString() !== clientId) {
      throw new HttpErrors.Forbidden('Not authorized for client-group write');
    }
  }

  private async buildLb3AccessToken(): Promise<Lb3AccessToken> {
    const clientId = await this.requireAuth();
    if (!clientId) {
      throw new HttpErrors.Unauthorized('Access token required');
    }
    const userId: Lb3UserId = {
      toHexString: () => clientId,
      toString: () => clientId,
    };
    return {userId};
  }

  private async buildLb3Options(): Promise<Lb3Options> {
    return {accessToken: await this.buildLb3AccessToken()};
  }
}
