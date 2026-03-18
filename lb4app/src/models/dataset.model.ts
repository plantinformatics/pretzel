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

  toJSON(): object {
    const json = super.toJSON() as {[key: string]: unknown};
    /* LB3 /api/datasets response contained just .name, whereas LB4 was
     * outputting both .id and .datasetId until the above change;
     *
     * When parsing the response to api-server.js:getDatasets(),
     * Ember data parses id as null (probably because it is not a ObjectID),
     * and gives this error : "You must include an 'id' for the resource data
     * dataset"
     * The solution implemented is to replace .datasetId and .id with .name.
     */
    const name = json.datasetId || json.id;
    if (name) {
      json.name = name;
      delete json.datasetId;
      delete json.id;
    }
    return json;
  }
}

export interface DatasetRelations {
  // describe navigational properties here
}

export type DatasetWithRelations = Dataset & DatasetRelations;
