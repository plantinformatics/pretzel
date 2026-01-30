import {Entity, model, property, hasMany} from '@loopback/repository';
import {Annotation} from './annotation.model';
import {Feature} from './feature.model';
import {Interval} from './interval.model';

@model({
  settings: {
    strict: false,
    description: 'Data block that contains features',
    /* Comment-out scope to disable auto-include because
     *  "include is being resolved before the inclusion resolver is registered or before the relation metadata is fully loaded."
     * More detail comment in commit message.
     */
    // scope: {include: ['annotations', 'intervals']}
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

  @hasMany(() => Annotation, {keyTo: 'blockId'})
  annotations: Annotation[];

  @hasMany(() => Feature)
  features: Feature[];

  @hasMany(() => Interval)
  intervals: Interval[];
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
  annotations?: Annotation[]; // Optional: add to interface for type safety
  features?: Feature[];
  intervals?: Interval[];
}

export type BlockWithRelations = Block & BlockRelations;
