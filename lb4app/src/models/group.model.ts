import {Entity, model, property, belongsTo, hasMany} from '@loopback/repository';
import {Client} from './client.model';
import {ClientGroup} from './client-group.model';

@model({
  settings: {
    strict: false,
    validateUpsert: true,
    description: 'User Group management services',
    idInjection: true
  }
})
export class Group extends Entity {
  @property({
    type: 'string',
    mongodb: {dataType: 'ObjectID'},
    id: 1,
    generated: true,
    updateOnly: true,
  })
  id?: string;

  @property({
    type: 'boolean',
    default: false,
  })
  writable?: boolean;

  @belongsTo(() => Client, {name: 'owner'})
  clientId: string;

  @hasMany(() => ClientGroup)
  clientGroups: ClientGroup[];

  @hasMany(() => Client, {through: {model: () => ClientGroup}})
  clients: Client[];
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Group>) {
    super(data);
  }
}

export interface GroupRelations {
  // describe navigational properties here
  owner?: Client;
  clientGroups?: ClientGroup[];
}

export type GroupWithRelations = Group & GroupRelations;
