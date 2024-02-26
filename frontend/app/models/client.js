import Model, { attr, hasMany } from '@ember-data/model';

export default class ClientModel extends Model {

  @attr('string') email;

  @hasMany('group', {async: true, inverse : 'clientId'}) groupsOwn;
  @hasMany('group', {async: true, inverse : 'clients'}) groups;
  @hasMany('client-group', {async: true, inverse : null/*'client'*/}) clientGroups;

}
