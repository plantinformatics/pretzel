import {model, property, hasMany} from '@loopback/repository';
import {User} from '.';
import {Group} from './group.model';
import {ClientGroup} from './client-group.model';

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

  @hasMany(() => Group, {through: {model: () => ClientGroup}})
  groups: Group[];
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
