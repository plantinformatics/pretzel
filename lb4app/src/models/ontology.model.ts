import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false, description: 'Read ontology data from web API'}})
export class Ontology extends Entity {
  @property({
    type: 'number',
    id: 1,
    generated: true,
    updateOnly: true,
  })
  id?: number;

  @property({
    type: 'object',
    required: true,
  })
  tree: object;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Ontology>) {
    super(data);
  }
}

export interface OntologyRelations {
  // describe navigational properties here
}

export type OntologyWithRelations = Ontology & OntologyRelations;
