import { inject as service } from '@ember/service';
import EmberObject, { computed, observer } from '@ember/object';
import { alias } from '@ember/object/computed';
import { later as run_later } from '@ember/runloop';

import $ from 'jquery';

import { toPromiseProxy, toArrayPromiseProxy } from '../../utils/ember-devel';
import { getGroups } from '../../utils/data/group';
import { noGroup } from '../../utils/data/groups';

import ManageBase from './manage-base';

/** @param: dataset **/

const dLog = console.debug;
const trace = 0;

/** Indicate whether user selects from /in groups, in addition to /own, to set dataset:group
 * If true then both are included.  (in e6db6e38 .. 18af19e1, the flag
 * selectFromOwn indicated to use either /own _or_ /in).
 * @see groupsPromise */
const selectIncludeIn = true;


export default ManageBase.extend({
  auth : service(),
  session: service(),
  apiServers : service(),


  editorVisible: false,
  toggleShowJsonViewer : true,
  currentMeta: {},


  onEditable : function() { dLog('onEditable'); return false; },

  ownedByMe: alias("dataset.owner"),
  apiHost : alias("dataset.store.name"),

  datasetMeta: computed("dataset._meta", function() {
    return this.get("dataset._meta") || {};
  }),
  copyToCurrentMeta : observer('dataset', function () {
    if (trace > 2) {
      dLog('copyToCurrentMeta', this.get('currentMeta'), this.get('dataset._meta'));
    }
    this.set('currentMeta', this.get('dataset._meta'));
    this.updateViewer();
  }),

  didReceiveAttrs() {
    this._super(...arguments);
    // dLog('didReceiveAttrs');
    this.copyToCurrentMeta();
  },

  mutateJson(json) {
    /*  mutateJson() is called after _change() has changed the json value
     *  passed (.currentMeta), so no need to change currentMeta here.
     if (trace > 1)
     dLog('mutateJson()', 'currentMeta => ', this.get("currentMeta"));
     this.set("currentMeta", json);
    */
    if (trace > 1)
      dLog('mutateJson()', 'currentMeta => ', this.get("currentMeta"));
    // this.get("dataset").save()
  },

  actions: {
    toggleEditor() {
      this.toggleProperty('editorVisible');
    },
    saveJSONToDB() {
      dLog('saveJSONToDB()', this.get("dataset._meta"), 'currentMeta', this.get("currentMeta"));
      this.set("dataset._meta", this.get("currentMeta"));
      this.get("dataset").save();
      this.send("toggleEditor");
    }
  },
  /** Force the json viewer to refresh by destroying the json-editor instance and re-creating it.
   * The json-editor viewer is wrapped with #if toggleShowJsonViewer
   * There may be an API for this, or perhaps add one to json-editor.
   */
  updateViewer() {
    this.toggleProperty('toggleShowJsonViewer');
    run_later(() => {
      this.toggleProperty('toggleShowJsonViewer');
      run_later(() => $('a.jsoneditor-value').attr('target', '_blank'));
    });
  },

  // ---------------------------------------------------------------------------

  /** @return true if the logged in user (Client) owns the selected dataset.
   * @desc this enables the change-group pull-down
 */
  datasetOwned : computed('dataset', function () {
    const
    datasetClientId = this.get('dataset.clientId'),
    sessionUserId = this.get('session.session.authenticated.clientId'),
    ok = datasetClientId === sessionUserId;
    dLog('datasetOwned', ok, datasetClientId, sessionUserId, this.get('dataset.id'));
    return ok;
  }),

  // ---------------------------------------------------------------------------

  server : computed(
    'dataset',
    function () {
    const
      store = this.dataset.store,
      apiServers = this.get('apiServers'),
      server = apiServers.lookupServerName(store.name);
      return server;
  }),

  /** Array of groups which the user may set .dataset.group to.
   * Originally inGroups, now ownGroups, after a change in requirements : only
   * the owner of a group can add datasets to it (originally a member of the
   * group could do that).
   */
  groupsPromise : computed(
    'dataset',
    'server.groups.{groupsInOwnNone,groupsOwn}',
    function () {
      let
      fnName = 'groupsPromise',
      /** 
    'session.session.authenticated.clientId',
          session : service(),
      clientId = this.get('session.session.authenticated.clientId'),
      */

      server = this.get('server'),
      groupsService = server.groups,
      /** If groupsOwn is used : create groupsOwnNone(), with noGroup prepended.  */
      groupsP = groupsService.get(selectIncludeIn ? 'groupsInOwnNone' : 'groupsOwn');
      groupsP.then((gs) => ! this.isDestroying && this.set('groupsValue', gs));
      return groupsP;
    }),

  /** Instead of using this in .hbs, helper (to-array-promise-proxy ) is used
   */
  get groups() {
    return {groups : toArrayPromiseProxy(this.get('groupsPromise'))};
  },
  /** find the current dataset.groupId within groupsValue. This is passed to
   * select-group to display the current value as initially selected.
   */
  selectedValue : computed('groupsValue', 'dataset.groupId.name', function () {
    const
    fnName = 'selectedValue',
    datasetGroupName = this.get('dataset.groupId.name'),
    groupsValue = this.get('groupsValue');
    let group;
    if (groupsValue && datasetGroupName) {
      group = groupsValue.findBy('name', datasetGroupName);
      if (! group) {
        dLog(fnName, groupsValue.map((g) => [g.id, g.name]));
      }
      dLog(fnName, datasetGroupName, group?.get('name'));
    }
    return group;
  }),

    // currentGroup = this.dataset.content.groupId.content,

  /** @param group  from .groupsValue, and noGroup
   */
  datasetChangeGroup(group) {
    const fnName = 'datasetChangeGroup';
    this.set('datasetGroupErrMsg', null);
    if (this.dataset.get('groupId.id') == group.get('id')) {
      dLog(fnName, 'no change', this.dataset.get('id'), group.get('id') );
    } else {
      this.dataset.set('groupId', group === noGroup ? null : group);
      this.dataset.save()
        .catch((err) => this.set('datasetGroupErrMsg', 'Dataset Group change ' + group.id + ' not saved.\n' + err));
    }
  },

});
