import {Entity, model, property} from '@loopback/repository';

@model({settings: {strict: false, description: 'Server run-time configuration, etc'}})
export class Configuration extends Entity {
  @property({
    type: 'number',
    id: 1,
    generated: true,
    updateOnly: true,
  })
  id?: number;

  @property({
    type: 'string',
    required: true,
  })
  name: string;

  @property({
    type: 'string',
    required: true,
  })
  value: string;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Configuration>) {
    super(data);
  }
}

export interface ConfigurationRelations {
  // describe navigational properties here
}

export type ConfigurationWithRelations = Configuration & ConfigurationRelations;
