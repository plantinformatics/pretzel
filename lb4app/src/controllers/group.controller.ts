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
  Request,
  RestBindings,
} from '@loopback/rest';
import {inject} from '@loopback/core';
import {Group} from '../models';
import {GroupRepository} from '../repositories';
import {Lb3ModelWrap} from '../utils/lb3-model-wrap';
import {Lb3ModelWrapFactory} from '../utils/lb3-model-wrap.provider';
import {parseLegacyQueryFilter} from '../utils/legacy-query-filter';

// @ts-ignore
const GroupModule = require('../../lb3app/common/models/group');

type GroupAddMemberBody = {
  id: string;
  addId: string;
};

type GroupAddMemberEmailBody = {
  id: string;
  addEmail: string;
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

export class GroupController {
  private lb3: Lb3ModelWrap;

  constructor(
    @repository(GroupRepository)
    public groupRepository : GroupRepository,
    @inject('utils.Lb3ModelWrap') private lb3WrapFactory: Lb3ModelWrapFactory,
  ) {}

  @post('/groups')
  @response(200, {
    description: 'Group model instance',
    content: {'application/json': {schema: getModelSchemaRef(Group)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Group, {
            title: 'NewGroup',
            exclude: ['id'],
          }),
        },
      },
    })
    group: Omit<Group, 'id'>,
  ): Promise<Group> {
    const accessToken = await this.buildLb3AccessToken();
    await this.invokeLb3BeforeRemoteCreate(group, accessToken);
    return this.groupRepository.create(group);
  }

  @get('/groups/count')
  @response(200, {
    description: 'Group model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Group) where?: Where<Group>,
  ): Promise<Count> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.groupRepository.count(where);
  }

  @get('/groups')
  @response(200, {
    description: 'Array of Group model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Group, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @inject(RestBindings.Http.REQUEST) req: Request,
  ): Promise<Group[]> {
    await this.requireAuth();
    const filter = parseLegacyQueryFilter<Group>((req.query as any).filter);
    return this.groupRepository.find(filter);
  }

  @patch('/groups')
  @response(200, {
    description: 'Group PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Group, {partial: true}),
        },
      },
    })
    group: Group,
    @param.where(Group) where?: Where<Group>,
  ): Promise<Count> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.groupRepository.updateAll(group, where);
  }

  @get('/groups/{id}')
  @response(200, {
    description: 'Group model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Group, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Group, {exclude: 'where'}) filter?: FilterExcludingWhere<Group>
  ): Promise<Group> {
    await this.authorizeGroupRead(id);
    return this.groupRepository.findById(id, filter);
  }

  @patch('/groups/{id}')
  @response(204, {
    description: 'Group PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Group, {partial: true}),
        },
      },
    })
    group: Group,
  ): Promise<void> {
    await this.authorizeGroupWrite(id);
    await this.groupRepository.updateById(id, group);
  }

  @put('/groups/{id}')
  @response(204, {
    description: 'Group PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() group: Group,
  ): Promise<void> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // await this.groupRepository.replaceById(id, group);
  }

  @del('/groups/{id}')
  @response(204, {
    description: 'Group DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.authorizeGroupWrite(id);
    const accessToken = await this.buildLb3AccessToken();
    await this.invokeLb3Observe('before delete', {where: {id}, accessToken});
    await this.groupRepository.deleteById(id);
    await this.invokeLb3Observe('after delete', {where: {id}, accessToken});
  }

  // -----------------------------------------------------------------------------

  @get('/Groups/own', {
    responses: {
      '200': {
        description: 'List groups which this user has created / owns',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async groupsOwn(): Promise<object[]> {
    return this.lb3Groups(true);
  }

  @get('/Groups/in', {
    responses: {
      '200': {
        description: 'List groups which this user is in',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async groupsIn(): Promise<object[]> {
    return this.lb3Groups(false);
  }

  @post('/Groups/addMember', {
    responses: {
      '200': {
        description: 'Add user to group, i.e. create a ClientGroup',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async addMember(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['id', 'addId'],
            properties: {
              id: {type: 'string'},
              addId: {type: 'string'},
            },
          },
        },
      },
    })
    body: GroupAddMemberBody,
  ): Promise<object> {
    const {id, addId} = body ?? {};
    if (!id || !addId) {
      throw new HttpErrors.BadRequest('id and addId are required');
    }
    await this.authorizeGroupWrite(id);
    const options = await this.buildLb3Options();
    this.lb3.bindLb3DataSource();
    return this.lb3.lb3Call<object>(cb => {
      // @ts-ignore
      this.lb3.model.addMember(id, addId, options, cb);
    });
  }

  @post('/Groups/addMemberEmail', {
    responses: {
      '200': {
        description: 'Add user email to group, i.e. create a ClientGroup',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async addMemberEmail(
    @requestBody({
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['id', 'addEmail'],
            properties: {
              id: {type: 'string'},
              addEmail: {type: 'string'},
            },
          },
        },
      },
    })
    body: GroupAddMemberEmailBody,
  ): Promise<object> {
    const {id, addEmail} = body ?? {};
    if (!id || !addEmail) {
      throw new HttpErrors.BadRequest('id and addEmail are required');
    }
    await this.requireAuth();
    const options = await this.buildLb3Options();
    this.lb3.bindLb3DataSource();
    return this.lb3.lb3Call<object>(cb => {
      // @ts-ignore
      this.lb3.model.addMemberEmail(id, addEmail, options, cb);
    });
  }

  @get('/api/groups/own')
  @response(200, {
    description: 'Array of Group model instances owned/created by the logged-in user',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Group, {includeRelations: true}),
        },
      },
    },
  })
  async findOwn(
    @param.filter(Group) filter?: Filter<Group>,
  ): Promise<Group[]> {
    console.log('/api/groups/own', filter);
    return this.lb3Groups(true) as Promise<Group[]>;
  }

  // -----------------------------------------------------------------------------

  private ensureLb3() {
    if (!this.lb3) {
      this.lb3 = this.lb3WrapFactory(GroupModule);
    }
  }

  private async buildLb3AccessToken(): Promise<Lb3AccessToken> {
    this.ensureLb3();
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

  private async lb3Groups(own: boolean): Promise<object[]> {
    const options = await this.buildLb3Options();
    this.lb3.bindLb3DataSource();
    return this.lb3.lb3CallNoCb<object[]>(() => {
      // @ts-ignore
      return this.lb3.model[own ? 'own' : 'in'](options);
    });
  }

  private async requireAuth(): Promise<string> {
    this.ensureLb3();
    const clientId = await this.lb3.authUtils.requireClientId();
    if (!clientId) {
      throw new HttpErrors.Unauthorized('Access token required');
    }
    return clientId;
  }

  private async authorizeGroupRead(groupId: string): Promise<void> {
    const clientId = await this.requireAuth();
    const group = await this.groupRepository.findById(groupId);
    if (group.clientId?.toString() === clientId) {
      return;
    }
    const groupIds = await this.lb3.authUtils.getClientGroupIds(clientId);
    if (groupIds.has(groupId)) {
      return;
    }
    if ((group as any).public) {
      return;
    }
    throw new HttpErrors.Forbidden('Not authorized for group read');
  }

  private async authorizeGroupWrite(groupId: string): Promise<void> {
    const clientId = await this.requireAuth();
    const group = await this.groupRepository.findById(groupId);
    if (group.clientId?.toString() === clientId) {
      return;
    }
    throw new HttpErrors.Forbidden('Not authorized for group write');
  }

  private async invokeLb3BeforeRemoteCreate(
    data: Omit<Group, 'id'>,
    accessToken: Lb3AccessToken,
  ): Promise<void> {
    this.ensureLb3();
    const handler = this.lb3.model['beforeRemote_create'];
    if (typeof handler !== 'function') {
      return;
    }
    const context = {accessToken, args: {data}};
    await new Promise<void>((resolve, reject) => {
      handler(context, undefined, (error?: unknown) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  private async invokeLb3Observe(
    eventName: string,
    args: {where: {id: string}; accessToken: Lb3AccessToken},
  ): Promise<void> {
    this.ensureLb3();
    const handler = this.lb3.model[`observe_${eventName}`];
    if (typeof handler !== 'function') {
      return;
    }
    const ctx = {
      Model: this.lb3.model,
      where: args.where,
      options: {accessToken: args.accessToken},
    };
    await new Promise<void>((resolve, reject) => {
      handler(ctx, (error?: unknown) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

}
