import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false}})
export class ClientGroup extends Entity {
  @property({
    type: 'string',
    id: true,
    generated: true,
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  clientId: string;

  @property({
    type: 'string',
    required: true,
  })
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
