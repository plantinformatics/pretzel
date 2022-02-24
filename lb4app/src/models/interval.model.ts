import {model, property} from '@loopback/repository';
import {Record} from '.';

@model({settings: {strict: false, description: 'Commentary on Feature range'}})
export class Interval extends Record {
  @property({
    type: 'ObjectID',
    id: 1,
    generated: true,
    updateOnly: true,
  })
  id?: ObjectID;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'array',
    default: [],
    itemType: 'string',
  })
  features?: string[];

  @property({
    type: 'array',
    default: [],
    itemType: 'string',
  })
  positions?: string[];

  @property({
    type: 'ObjectID',
  })
  clientId?: ObjectID;

  @property({
    type: 'ObjectID',
  })
  groupId?: ObjectID;

  @property({
    type: 'ObjectID',
  })
  blockId?: ObjectID;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Interval>) {
    super(data);
  }
}

export interface IntervalRelations {
  // describe navigational properties here
}

export type IntervalWithRelations = Interval & IntervalRelations;
