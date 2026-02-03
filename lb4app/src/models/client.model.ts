import {model, property, hasMany} from '@loopback/repository';
import {User} from './user.model';
import {Group} from './group.model';
import {ClientGroup} from './client-group.model';
import {Dataset} from './dataset.model';
import {Block} from './block.model';
import {Annotation} from './annotation.model';
import {Interval} from './interval.model';

@model({
  settings: {
    strict: false,
    validateUpsert: true,
    description: 'User management services',
    idInjection: true,
    emailVerificationRequired: true
  }
})
export class Client extends User {
  @property({
    type: 'array',
    itemType: 'string',
  })
  groupIds?: string[];

  @hasMany(() => Group, {through: {model: () => ClientGroup}})
  groups: Group[];

  @hasMany(() => ClientGroup)
  clientGroups: ClientGroup[];

  @hasMany(() => Dataset)
  datasets: Dataset[];

  @hasMany(() => Block)
  blocks: Block[];

  @hasMany(() => Annotation)
  annotations: Annotation[];

  @hasMany(() => Interval)
  intervals: Interval[];
  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<Client>) {
    super(data);
  }
}

export interface ClientRelations {
  // describe navigational properties here
}

export type ClientWithRelations = Client & ClientRelations;
