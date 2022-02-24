import {model, property} from '@loopback/repository';
import {Record} from '.';

@model({settings: {strict: false, description: 'Data commentary and insights'}})
export class Annotation extends Record {
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
    type: 'string',
    mongodb: {dataType: 'ObjectID'},
  })
  clientId?: string;

  @property({
    type: 'string',
    mongodb: {dataType: 'ObjectID'},
  })
  groupId?: string;

  @property({
    type: 'string',
    mongodb: {dataType: 'ObjectID'},
  })
  blockId?: string;

  @property({
    type: 'string',
    mongodb: {dataType: 'ObjectID'},
  })
  featureId?: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Annotation>) {
    super(data);
  }
}

export interface AnnotationRelations {
  // describe navigational properties here
}

export type AnnotationWithRelations = Annotation & AnnotationRelations;
