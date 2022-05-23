import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strict: false,
    description: //[
      'Schema for Scope which represents the permissions that are granted' + ' ' + //,
      'to client applications by the resource owner'
    //]
  }
})
export class Scope extends Entity {
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
  })
  name: string;

  @property({
    type: 'string',
  })
  description?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Scope>) {
    super(data);
  }
}

export interface ScopeRelations {
  // describe navigational properties here
}

export type ScopeWithRelations = Scope & ScopeRelations;
