import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strict: false,
    validateUpsert: true,
    description: 'Unit of data that can contain other units',
    idInjection: true,
    indexes: {block_index: {keys: {blockId: 1}}}
  }
})
export class Feature extends Entity {
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
  name: string;

  @property({
    type: 'any',
    required: true,
  })
  value: any;

  @property({
    type: 'string',
    mongodb: {dataType: 'ObjectID'},
  })
  blockId?: string;

  @property({
    type: 'string',
    mongodb: {dataType: 'ObjectID'},
  })
  parentId?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Feature>) {
    super(data);
  }
}

export interface FeatureRelations {
  // describe navigational properties here
}

export type FeatureWithRelations = Feature & FeatureRelations;
