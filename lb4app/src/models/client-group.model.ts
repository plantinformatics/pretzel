import {Entity, model, property, belongsTo} from '@loopback/repository';
import {Client} from './client.model';
import {Group} from './group.model';

@model({settings: {strict: false}})
export class ClientGroup extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;
  @belongsTo(() => Client)
  clientId: string;

  @belongsTo(() => Group)
  groupId: string;
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<ClientGroup>) {
    super(data);
  }
}

export interface ClientGroupRelations {
  // describe navigational properties here
}

export type ClientGroupWithRelations = ClientGroup & ClientGroupRelations;
