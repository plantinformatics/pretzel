import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { alias } from '@ember/object/computed';


const dLog = console.debug;

export default class GroupsRoute extends Route {
  @service controls;

  @alias('controls.apiServerSelectedOrPrimary') server;
  @alias('server.groups') groups;

  model() {
    let
    // filter :  {'include': 'clients'}
    // filter: {clientId} (where : {clientId} )
    // store.query('group', {}),

    fieldNames = ['groupsIn', 'groupsOwn'],
    groupsP = fieldNames.map((fieldName) => [fieldName, this.get('groups').get(fieldName)]),
    modelP = Object.fromEntries(groupsP);
    modelP.groupsOwn.then((gs) => console.log('routes/groups:model() groupsOwn.then', gs.map((g) => [g.get('id'), g.get('name')]))); 

    return modelP;
  }

  @action
  refreshModel() {
    this.get('groups').refresh();
    this.refresh();
  }

}
