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
/** From : https://github.com/loopbackio/loopback-next/blob/master/examples/access-control-migration/src/controllers/user.controller.ts
 * Referenced in : https://loopback.io/doc/en/lb4/migration-authentication.html#mounting-authentication-component
 */
import {TokenService, UserService} from '@loopback/authentication';
import {inject} from '@loopback/core';
import {  SchemaObject} from '@loopback/rest';

import {
  Credentials,
  TokenServiceBindings,
  UserServiceBindings,
} from '@loopback/authentication-jwt';

import {Client} from '../models';
import {ClientRepository} from '../repositories';
import {MongoDsDataSource} from '../datasources';
const {Lb3ModelClient} = require('../../lb3app/common/models/client');

//------------------------------------------------------------------------------
// From : https://github.com/loopbackio/loopback-next/blob/master/examples/access-control-migration/src/controllers/user.controller.ts

const CredentialsSchema: SchemaObject = {
  type: 'object',
  required: ['email', 'password'],
  properties: {
    email: {
      type: 'string',
      format: 'email',
    },
    password: {
      type: 'string',
      minLength: 6,	// 8
    },
  },
};

export const CredentialsRequestBody = {
  description: 'The input of login function',
  required: true,
  content: {
    'application/json': {schema: CredentialsSchema},
  },
};

//------------------------------------------------------------------------------

type ClientLoginResponse = {
  id: string;
  userId?: string;
  ttl?: number;
  token?: string;
};

export class ClientController {
  private lb3Client: InstanceType<typeof Lb3ModelClient>;

  constructor(
    @inject(TokenServiceBindings.TOKEN_SERVICE)
    public jwtService: TokenService,
    @inject(UserServiceBindings.USER_SERVICE)
    public userService: UserService<Client, Credentials>,
    @inject('services.Email')
    public emailService: any,
    @inject('datasources.mongoDs')
    public mongoDs: MongoDsDataSource,
    @repository(ClientRepository)
    public clientRepository : ClientRepository,
  ) {
    this.lb3Client = new Lb3ModelClient(
      /*Client:*/ this.clientRepository,
      /*Email:*/ this.emailService,
    );
  }

  @post('/clients')
  @response(200, {
    description: 'Client model instance',
    content: {'application/json': {schema: getModelSchemaRef(Client)}},
  })
  async create(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Client, {
            title: 'NewClient',
            exclude: ['id'],
          }),
        },
      },
    })
    client: Omit<Client, 'id'>,
  ): Promise<Client> {
    await this.requireAccessToken(req);
    return this.clientRepository.create(client);
  }

  @get('/clients/count')
  @response(200, {
    description: 'Client model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Client) where?: Where<Client>,
  ): Promise<Count> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.clientRepository.count(where);
  }

  @get('/clients')
  @response(200, {
    description: 'Array of Client model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Client, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Client) filter?: Filter<Client>,
  ): Promise<Client[]> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.clientRepository.find(filter);
  }

  @patch('/clients')
  @response(200, {
    description: 'Client PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Client, {partial: true}),
        },
      },
    })
    client: Client,
    @param.where(Client) where?: Where<Client>,
  ): Promise<Count> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.clientRepository.updateAll(client, where);
  }

  @get('/clients/{id}')
  @response(200, {
    description: 'Client model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Client, {includeRelations: true}),
      },
    },
  })
  async findById(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @param.path.string('id') id: string,
    @param.filter(Client, {exclude: 'where'}) filter?: FilterExcludingWhere<Client>
  ): Promise<Client> {
    await this.requireAccessToken(req);
    return this.clientRepository.findById(id, filter);
  }

  @patch('/clients/{id}')
  @response(204, {
    description: 'Client PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Client, {partial: true}),
        },
      },
    })
    client: Client,
  ): Promise<void> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // await this.clientRepository.updateById(id, client);
  }

  @put('/clients/{id}')
  @response(204, {
    description: 'Client PUT success',
  })
  async replaceById(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @param.path.string('id') id: string,
    @requestBody() client: Client,
  ): Promise<void> {
    await this.requireAccessToken(req);
    await this.clientRepository.replaceById(id, client);
  }

  @del('/clients/{id}')
  @response(204, {
    description: 'Client DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // await this.clientRepository.deleteById(id);
  }

  //----------------------------------------------------------------------------
  // LB3-compatible /Clients endpoints

  @post('/Clients/', {
    responses: {
      '200': {
        description: 'Client model instance',
        content: {'application/json': {schema: getModelSchemaRef(Client)}},
      },
    },
  })
  async createClient(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Client, {
            title: 'NewClient',
            exclude: ['id'],
          }),
        },
      },
    })
    client: Omit<Client, 'id'>,
  ): Promise<Client> {
    const created = await this.clientRepository.create(client);
    if (this.lb3Client?.afterRemoteCreateP) {
      const context = {result: {} as any, req, res: undefined};
      await this.lb3Client.afterRemoteCreateP(context as any, created);
    }
    return created;
  }

  // Mostly the same as : https://github.com/loopbackio/loopback-next/blob/master/examples/access-control-migration/src/controllers/user.controller.ts 
  // with change of result type : {token: string} -> ClientLoginResponse
  // (this omits : properties: { token: { type: 'string', }, }, )
  @post('/Clients/login', {
    responses: {
      '200': {
        description: 'Token',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async clientLogin(
    @requestBody(CredentialsRequestBody) credentials: Credentials,
  ): Promise<ClientLoginResponse> {

/*
    if ((this.userService as any).userRepository.modelClass === this.userRepository.modelClass) {
      console.log(
	'ClientController : clientLogin()', 
	this, this.userService, this.userRepository, this.clientRepository
      );
      (this.userService as any).userRepository = this.clientRepository;
    }
*/

    // ensure the user exists, and the password is correct
    const user = await this.userService.verifyCredentials(credentials);
    // convert a User object into a UserProfile object (reduced set of properties)
    const userProfile = this.userService.convertToUserProfile(user);
    // create a JSON Web Token based on the user profile
    const token = await this.jwtService.generateToken(userProfile);
    return {
      id: token,
      token,
      userId: (user as any).id,
      ttl: this.getTokenTtl(),
    };
  }

  @post('/Clients/change-password', {
    responses: {
      '204': {
        description: 'Password changed',
      },
    },
  })
  async changePassword(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @requestBody() data: {oldPassword?: string; newPassword?: string},
  ): Promise<void> {
    const {oldPassword, newPassword} = data ?? {};
    if (!oldPassword || !newPassword) {
      throw new HttpErrors.BadRequest('oldPassword and newPassword are required');
    }
    const userId = await this.getUserIdFromToken(req);
    const user = await this.clientRepository.findById(userId);
    await this.userService.verifyCredentials({
      email: (user as any).email,
      password: oldPassword,
    });
    await this.clientRepository.updateById(userId, {password: newPassword} as any);
  }

  @post('/Clients/reset', {
    responses: {
      '200': {
        description: 'Reset password request accepted',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async resetRequest(
    @requestBody() data: {email?: string},
  ): Promise<{status: string}> {
    const email = data?.email;
    if (!email) {
      throw new HttpErrors.BadRequest('email is required');
    }
    const user = await this.clientRepository.findOne({where: {email}});
    if (!user) {
      return {status: 'ok'};
    }
    const userProfile = this.userService.convertToUserProfile(user as any);
    const token = await this.jwtService.generateToken(userProfile);
    if (this.lb3Client?.onResetPasswordRequestP) {
      try {
        await this.lb3Client.onResetPasswordRequestP({
          email,
          accessToken: {id: token},
        } as any);
      } catch (err) {
        // keep reset flow from failing if email is not configured
        // eslint-disable-next-line no-console
        console.warn('resetPasswordRequest email hook failed', err);
      }
    }
    return {status: 'ok'};
  }

  @post('/Clients/reset-password', {
    responses: {
      '204': {
        description: 'Password reset',
      },
    },
  })
  async resetPassword(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @requestBody() data: {newPassword?: string},
  ): Promise<void> {
    const {newPassword} = data ?? {};
    if (!newPassword) {
      throw new HttpErrors.BadRequest('newPassword is required');
    }
    const userId = await this.getUserIdFromToken(req);
    await this.clientRepository.updateById(userId, {password: newPassword} as any);
  }

  @get('/Clients/confirm', {
    responses: {
      '200': {
        description: 'Confirm client email',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async confirm(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.query.string('uid') uid?: string,
    @param.query.string('token') token?: string,
    @param.query.string('redirect') redirect?: string,
  ): Promise<object | void> {
    if (!uid) {
      throw new HttpErrors.BadRequest('uid is required');
    }
    const context = {args: {uid, token, redirect}, req, res};
    if (this.lb3Client?.beforeRemoteConfirmP) {
      await this.lb3Client.beforeRemoteConfirmP(context as any, {} as any);
    }
    if (res.headersSent) return;

    const user = await this.clientRepository.findById(uid);
    if (token && (user as any).verificationToken && token !== (user as any).verificationToken) {
      throw new HttpErrors.BadRequest('Invalid verification token');
    }
    await this.clientRepository.updateById(uid, {
      emailVerified: true,
      verificationToken: null,
    } as any);

    if (this.lb3Client?.afterRemoteConfirmP) {
      await this.lb3Client.afterRemoteConfirmP(context as any, {} as any);
    }
    if (redirect) {
      res.redirect(redirect);
      return;
    }
    return {status: 'ok'};
  }

  private getTokenTtl(): number | undefined {
    const ttl = (Client as any).definition?.settings?.ttl ?? (Client as any).settings?.ttl;
    return typeof ttl === 'number' ? ttl : 1209600;
  }

  private async getUserIdFromToken(req: Request): Promise<string> {
    const headerToken = req.headers?.authorization;
    const queryToken = (req.query as any)?.access_token;
    const rawToken = Array.isArray(headerToken) ? headerToken[0] : headerToken || queryToken;
    if (!rawToken || typeof rawToken !== 'string') {
      throw new HttpErrors.Unauthorized('Access token is required');
    }
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
    const profile = await this.jwtService.verifyToken(token);
    const id = (profile as any).id ?? (profile as any).userId ?? (profile as any).sub;
    if (!id) {
      throw new HttpErrors.Unauthorized('Access token is invalid');
    }
    return String(id);
  }

  private async requireAccessToken(req: Request): Promise<string | undefined> {
    if (process.env.AUTH === 'NONE') return undefined;
    const headerToken = req.headers?.authorization;
    const queryToken = (req.query as any)?.access_token;
    const rawToken = Array.isArray(headerToken) ? headerToken[0] : headerToken || queryToken;
    if (!rawToken || typeof rawToken !== 'string') {
      throw new HttpErrors.Unauthorized('Access token is required');
    }
    const token = rawToken.startsWith('Bearer ') ? rawToken.slice(7) : rawToken;
    const connector = this.mongoDs.connector as any;
    const db = connector?.db ?? connector;
    if (!db?.collection) {
      throw new HttpErrors.Unauthorized('Access token is invalid');
    }
    const accessToken = await db.collection('AccessToken').findOne({_id: token});
    const userId = accessToken?.userId;
    if (!userId) {
      throw new HttpErrors.Unauthorized('Access token is invalid');
    }
    return userId.toString();
  }
}
