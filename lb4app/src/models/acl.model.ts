import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false}})
export class Acl extends Entity {
  @property({
    type: 'number',
    id: 1,
    generated: true,
    updateOnly: true,
  })
  id?: number;

  @property({
    type: 'string',
    description: 'The name of the model',
  })
  model?: string;

  @property({
    type: 'string',
    description: 'The name of the property, method, scope, or relation',
  })
  property?: string;

  @property({
    type: 'string',
  })
  accessType?: string;

  @property({
    type: 'string',
  })
  permission?: string;

  @property({
    type: 'string',
  })
  principalType?: string;

  @property({
    type: 'string',
  })
  principalId?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Acl>) {
    super(data);
  }
}

export interface AclRelations {
  // describe navigational properties here
}

export type AclWithRelations = Acl & AclRelations;
