import { inject as service } from '@ember/service';
import { computed, observer } from '@ember/object';
import { alias } from '@ember/object/computed';
import { later as run_later } from '@ember/runloop';

import $ from 'jquery';

import { toPromiseProxy, toArrayPromiseProxy } from '../../utils/ember-devel';
import { getGroups } from '../../utils/data/group';

import ManageBase from './manage-base';

/** @param: dataset **/

const dLog = console.debug;
const trace = 0;

export default ManageBase.extend({
  auth : service(),
  controls : service(),

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

  inGroupsPromise : computed(
    'controls.apiServerSelectedOrPrimary.store',
    function () {
      let
      fnName = 'inGroups',
      /** 
    'session.session.authenticated.clientId',
          session : service(),
      clientId = this.get('session.session.authenticated.clientId'),
      */
      store = this.get('controls.apiServerSelectedOrPrimary.store'),
      clientGroupsP = getGroups(this.get('auth'), /*own*/false, store),
      /** cgs[i] is model:client-group, cgs[i].get('groupId') is Proxy, so use .content to get model:group */
      groupsP = clientGroupsP.then((cgs) => {
        /** API lookup failure for a groupId leads to g.name undefined here.
         * Will also filter out non-existent groupId from groups/in
         */
        let gs = cgs.mapBy('groupId.content')
            .filter((g) => g.name);
        dLog(fnName, 'gs', gs);
        this.set('inGroupsValue', gs);  return gs;});
      return groupsP;
    }),
  get inGroups() {
    return {groups : toArrayPromiseProxy(this.get('inGroupsPromise'))};
  },
  selectedValue : computed('inGroupsValue', 'dataset.groupId.name', function () {
    const
    fnName = 'selectedValue',
    datasetGroupName = this.get('dataset.groupId.name'),
    inGroupsValue = this.get('inGroupsValue');
    let group;
    if (inGroupsValue && datasetGroupName) {
      group = inGroupsValue.findBy('name', datasetGroupName);
      if (! group) {
        dLog(fnName, inGroupsValue.map((g) => [g.id, g.name]));
      }
      dLog(fnName, datasetGroupName, group?.get('name'));
    }
    return group;
  }),

  selectedGroupChanged(selectedGroupId) {
    const fnName = 'selectedGroupChanged';
    let
    // currentGroup = this.dataset.content.groupId.content,
    gsP = this.inGroupsPromise,
    selectedGroup = gsP.then((gs) => {
      let
      groupValue = gs.findBy('id', selectedGroupId);
      dLog(fnName, selectedGroupId, groupValue?.name, groupValue?.id, arguments, this);
      this.datasetChangeGroup(groupValue);
    });
  },
  datasetChangeGroup(group) {
    const fnName = 'datasetChangeGroup';
    if (this.dataset.get('groupId.id') == group.get('id')) {
      dLog(fnName, 'no change', this.dataset.get('id'), group.get('id') );
    } else {
      this.dataset.set('groupId', group);
      this.dataset.save()
        .catch((err) => this.set('datasetGroupErrMsg', 'Dataset Group change ' + group.id + ' not saved.\n' + err));
    }
  },

});
