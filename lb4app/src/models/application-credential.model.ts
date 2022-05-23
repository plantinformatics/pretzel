import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false}})
export class ApplicationCredential extends Entity {
  @property({
    type: 'number',
    id: 1,
    generated: true,
    updateOnly: true,
  })
  id?: number;

  @property({
    type: 'string',
    required: true,
    comments: 'Facebook, google, twitter, linkedIn',
  })
  provider: string;

  @property({
    type: 'string',
    comments: 'oAuth, oAuth 2.0, OpenID, OpenID Connect',
  })
  authScheme?: string;

  @property({
    type: 'object',
  })
  credentials?: object;

  @property({
    type: 'date',
  })
  created?: string;

  @property({
    type: 'date',
  })
  modified?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<ApplicationCredential>) {
    super(data);
  }
}

export interface ApplicationCredentialRelations {
  // describe navigational properties here
}

export type ApplicationCredentialWithRelations = ApplicationCredential & ApplicationCredentialRelations;
