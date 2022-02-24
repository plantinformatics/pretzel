import {Entity, model, property} from '@loopback/repository';

@model({
  settings: {
    strict: false,
    description: 'Map principals to roles',
    strictObjectIDCoercion: true
  }
})
export class RoleMapping extends Entity {
  @property({
    type: 'number',
    id: true,
    generated: true,
    updateOnly: true,
  })
  id?: number;

  @property({
    type: 'string',
    description: 'The principal type, such as USER, APPLICATION, ROLE, or user model name in case of multiple user models',
  })
  principalType?: string;

  @property({
    type: 'string',
    index: true,
  })
  principalId?: string;

  @property({
    type: 'number',
  })
  roleId?: number;

  // Define well-known properties here

  // Indexer property to allow additional data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [prop: string]: any;

  constructor(data?: Partial<RoleMapping>) {
    super(data);
  }
}

export interface RoleMappingRelations {
  // describe navigational properties here
}

export type RoleMappingWithRelations = RoleMapping & RoleMappingRelations;
