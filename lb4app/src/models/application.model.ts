import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false, forceId: false}})
export class Application extends Entity {
  @property({
    type: 'string',
    id: true,
  })
  id?: string;

  @property({
    type: 'string',
  })
  realm?: string;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'string',
  })
  description?: string;

  @property({
    type: 'string',
    description: 'The icon image url',
  })
  icon?: string;

  @property({
    type: 'string',
    description: 'The user id of the developer who registers the application',
  })
  owner?: string;

  @property({
    type: 'array',
    description: 'A list of users ids who have permissions to work on this app',
    itemType: 'string',
  })
  collaborators?: string[];

  @property({
    type: 'string',
  })
  email?: string;

  @property({
    type: 'boolean',
  })
  emailVerified?: boolean;

  @property({
    type: 'string',
    description: 'The application URL for OAuth 2.0',
  })
  url?: string;

  @property({
    type: 'array',
    description: 'OAuth 2.0 code/token callback URLs',
    itemType: 'string',
  })
  callbackUrls?: string[];

  @property({
    type: 'array',
    description: 'A list of permissions required by the application',
    itemType: 'string',
  })
  permissions?: string[];

  @property({
    type: 'string',
  })
  clientKey?: string;

  @property({
    type: 'string',
  })
  javaScriptKey?: string;

  @property({
    type: 'string',
  })
  restApiKey?: string;

  @property({
    type: 'string',
  })
  windowsKey?: string;

  @property({
    type: 'string',
  })
  masterKey?: string;

  @property({
    type: 'AnonymousModel_0',
    apns: {production: {type: 'boolean', description: ['Production or development mode. It denotes what default APNS', 'servers to be used to send notifications.', 'See API documentation for more details.']}, certData: {type: 'string', description: 'The certificate data loaded from the cert.pem file'}, keyData: {type: 'string', description: 'The key data loaded from the key.pem file'}, pushOptions: {type: {gateway: 'string', port: 'number'}}, feedbackOptions: {type: {gateway: 'string', port: 'number', batchFeedback: 'boolean', interval: 'number'}}},
    gcm: {serverApiKey: 'string'},
  })
  pushSettings?: object; // AnonymousModel_0;

  @property({
    type: 'boolean',
    default: true,
  })
  authenticationEnabled?: boolean;

  @property({
    type: 'boolean',
    default: true,
  })
  anonymousAllowed?: boolean;

  @property({
    0: {scheme: {type: 'string', description: 'See the API docs for the list of supported values.'}, credential: {type: 'object', description: 'Scheme-specific credentials'}},
    type: 'array',
    itemType: 'AnonymousModel_5',
  })
  authenticationSchemes?: string[];

  @property({
    type: 'string',
    default: 'sandbox',
    description: 'Status of the application, production/sandbox/disabled',
  })
  status?: string;

  @property({
    type: 'date',
    defaultFn: 'now',
  })
  created?: string;

  @property({
    type: 'date',
    defaultFn: 'now',
  })
  modified?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Application>) {
    super(data);
  }
}

export interface ApplicationRelations {
  // describe navigational properties here
}

export type ApplicationWithRelations = Application & ApplicationRelations;
