import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strict: false,
    description: 'Data block that contains features',
    scope: {include: ['annotations', 'intervals']}
  }
})
export class Block extends Entity {
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
  })
  scope?: string;

  @property({
    type: 'string',
  })
  name?: string;

  @property({
    type: 'array',
    itemType: 'number',
  })
  range?: number[];

  @property({
    type: 'string',
  })
  namespace?: string;

  @property({
    type: 'string',
  })
  datasetId?: string;

  @property({
    type: 'string',
    mongodb: {dataType: 'ObjectID'},
  })
  clientId?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Block>) {
    super(data);
  }
}

export interface BlockRelations {
  // describe navigational properties here
}

export type BlockWithRelations = Block & BlockRelations;
