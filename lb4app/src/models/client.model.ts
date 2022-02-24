import {model, property} from '@loopback/repository';
import {User} from '.';

@model({
  settings: {
    strict: false,
    validateUpsert: true,
    description: 'User management services',
    idInjection: true
  }
})
export class Client extends User {
  @property({
    type: 'array',
    itemType: 'string',
  })
  groupIds?: string[];

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Client>) {
    super(data);
  }
}

export interface ClientRelations {
  // describe navigational properties here
}

export type ClientWithRelations = Client & ClientRelations;
