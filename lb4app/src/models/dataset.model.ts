import {model, property} from '@loopback/repository';
import {Record} from '.';

@model({
  settings: {
    strict: false,
    forceId: false,
    description: 'High level data structure containing blocks'
  }
})
export class Dataset extends Record {
  @property({
    type: 'string',
    required: true,
    id: true,
  })
  name: string;

  @property({
    type: 'array',
    itemType: 'string',
  })
  tags?: string[];

  @property({
    type: 'string',
  })
  type?: string;

  @property({
    type: 'string',
  })
  namespace?: string;

  @property({
    type: 'object',
  })
  meta?: object;

  @property({
    type: 'ObjectID',
  })
  clientId?: ObjectID;

  @property({
    type: 'ObjectID',
  })
  groupId?: ObjectID;

  @property({
    type: 'string',
  })
  parentId?: string;

  @property({
    type: 'string',
  })
  parent?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Dataset>) {
    super(data);
  }
}

export interface DatasetRelations {
  // describe navigational properties here
}

export type DatasetWithRelations = Dataset & DatasetRelations;
