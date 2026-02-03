import {model, property, hasMany, belongsTo} from '@loopback/repository';
import {Record} from './record.model';
import {Block} from './block.model';
import {Group} from './group.model';

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
    type: 'string',
  })
  parentId?: string;
  @hasMany(() => Block)
  blocks: Block[];

  @belongsTo(() => Dataset, {name: 'parentId'})
  parent: string;

  @hasMany(() => Dataset, {keyTo: 'parent'})
  children: Dataset[];
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
