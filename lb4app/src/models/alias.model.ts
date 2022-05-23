import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false, description: 'Contains a link between two features'}})
export class Alias extends Entity {
  @property({
    type: 'string',
    mongodb: {dataType: 'ObjectID'},
    id: 1,
    generated: true,
    updateOnly: true,
  })
  id?: string;

  @property({
    type: 'string',
    required: true,
  })
  string1: string;

  @property({
    type: 'string',
    required: true,
  })
  string2: string;

  @property({
    type: 'string',
  })
  namespace1?: string;

  @property({
    type: 'string',
  })
  namespace2?: string;

  @property({
    type: 'object',
  })
  evidence?: object;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Alias>) {
    super(data);
  }
}

export interface AliasRelations {
  // describe navigational properties here
}

export type AliasWithRelations = Alias & AliasRelations;
