import { inject as service } from '@ember/service';
import { computed, observer } from '@ember/object';
import { alias } from '@ember/object/computed';
import { later as run_later } from '@ember/runloop';

import $ from 'jquery';

import { toArrayPromiseProxy } from '../../utils/ember-devel';

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

  datasetMeta: Ember.computed("dataset._meta", function() {
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

  inGroups : computed(
    'controls.apiServerSelectedOrPrimary.store',
    function () {
      let
      /** 
    'session.session.authenticated.clientId',
          session : service(),
      clientId = this.get('session.session.authenticated.clientId'),
      */
      store = this.get('controls.apiServerSelectedOrPrimary.store'),
      groupsP = this.get('auth').groups(/*own*/false),
      modelP = {groups : toArrayPromiseProxy(groupsP)};
      return modelP;
    }),

  selectedGroupChanged(selectedGroupId) {
    let
    // currentGroup = this.dataset.content.groupId.content,
    gs = this.inGroups.groups,
    selectedGroup = gs.findBy('group.id', selectedGroupId),
    groupValue = selectedGroup.group;
    dLog('selectedGroupChanged', selectedGroupId, selectedGroup, groupValue?.name, groupValue?.id, arguments, this);
    if (groupValue?.id) {
      let
      store = this.dataset.store;
      store.findRecord('group', groupValue.id)
        .catch((err) => this.set('datasetGroupErrMsg', 'Group ' + selectedGroupId + ':' + groupValue.id + ' not found.\n' + err))
        .then((group) => {
          if (! group) {
            this.set('datasetGroupErrMsg', 'Group ' + selectedGroupId + ':' + groupValue.id + ' not found');
          } else {
            this.dataset.set('groupId', group);
            this.dataset.save()
              .catch((err) => this.set('datasetGroupErrMsg', 'Dataset Group change ' + selectedGroupId + ':' + groupValue.id + ' not saved.\n' + err));
          }
        });
    }
  },

});
