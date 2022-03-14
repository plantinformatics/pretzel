import Model, { attr, hasMany } from '@ember-data/model';

export default class ClientModel extends Model {

  @attr('string') email;

  @hasMany('group', {inverse : 'clientId'}) groupsOwn;
  @hasMany('group', {inverse : 'clients'}) groups;
  @hasMany('clientGroup') clientGroups;

}
