import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strict: false,
    validateUpsert: true,
    description: 'Base model for owned resources',
    idInjection: true
  }
})
export class Record extends Entity {
  @property({
    type: 'number',
    id: 1,
    generated: true,
    updateOnly: true,
  })
  id?: number;

  @property({
    type: 'boolean',
    default: false,
  })
  public?: boolean;

  @property({
    type: 'boolean',
    default: true,
  })
  readOnly?: boolean;

  @property({
    type: 'date',
    default: $now,
  })
  createdAt?: string;

  @property({
    type: 'date',
    default: $now,
  })
  updatedAt?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Record>) {
    super(data);
  }
}

export interface RecordRelations {
  // describe navigational properties here
}

export type RecordWithRelations = Record & RecordRelations;
