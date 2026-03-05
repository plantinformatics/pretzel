import {model, property, hasMany, belongsTo} from '@loopback/repository';
import {Record} from './record.model';
import {Block} from './block.model';
import {Group} from './group.model';

@model({
  settings: {
    strict: false,
    forceId: false,
    /* refn : https://github.com/loopbackio/loopback-connector-mongodb#strictobjectidcoercion-flag
     * Don't coerce id to ObjectID because it is text.
     * This applies to all properties - OK because none will be ObjectID.
     */
    strictObjectIDCoercion: false,
    description: 'High level data structure containing blocks'
  }
})
export class Dataset extends Record {
  @property({
    type: 'string',
    required: true,
    id: true,	// This marks it as the primary key
    generated: false, // Prevents automatic ObjectID generation
    /* If mongodb is not present, for property id it defaults to dataType : 'ObjectID'.
     * This is used in : node_modules/loopback-connector-mongodb/lib/mongodb.js
     * MongoDB.create() -> MongoDB.coerceId() -> coerceToObjectId() -> isObjectIDProperty()
     * ObjectIdTypeRegex is /objectid/i
     */
    mongodb: {dataType: 'string'},
  })
  id: string;

  @property({
    type: 'string',
    required: true,
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
