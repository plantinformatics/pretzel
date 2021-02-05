import { computed, observer } from '@ember/object';
import { alias } from '@ember/object/computed';
import { later as run_later } from '@ember/runloop';

import ManageBase from './manage-base';

/** @param: dataset **/

const dLog = console.debug;
const trace = 0;

export default ManageBase.extend({
  editorVisible: false,
  toggleShowJsonViewer : true,
  currentMeta: {},

  onEditable : function() { dLog('onEditable'); return false; },

  ownedByMe: alias("dataset.owner"),
  apiHost : alias("dataset.store.name"),

  datasetMeta: Ember.computed("dataset._meta", function() {
    return this.get("dataset._meta") || {}
  }),
  copyToCurrentMeta : observer('dataset', function () {
    dLog('copyToCurrentMeta', this.get('currentMeta'), this.get('dataset._meta'));
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
    run_later(() => this.toggleProperty('toggleShowJsonViewer'));
  }

});
