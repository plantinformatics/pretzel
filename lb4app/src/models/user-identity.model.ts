import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false}})
export class UserIdentity extends Entity {
  @property({
    type: 'number',
    id: 1,
    generated: true,
    updateOnly: true,
  })
  id?: number;

  @property({
    type: 'string',
    comments: facebook, google, twitter, linkedin,
  })
  provider?: string;

  @property({
    type: 'string',
    comments: oAuth, oAuth 2.0, OpenID, OpenID Connect,
  })
  authScheme?: string;

  @property({
    type: 'string',
    comments: The provider specific id,
  })
  externalId?: string;

  @property({
    type: 'object',
  })
  profile?: object;

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

  @property({
    type: 'ObjectID',
  })
  userId?: ObjectID;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<UserIdentity>) {
    super(data);
  }
}

export interface UserIdentityRelations {
  // describe navigational properties here
}

export type UserIdentityWithRelations = UserIdentity & UserIdentityRelations;
