import ManageBase from './manage-base';
import Ember from 'ember';

/** @param: dataset **/

const dLog = console.debug;
const trace = 0;

export default ManageBase.extend({
  editorVisible: false,
  currentMeta: {},

  ownedByMe: Ember.computed.alias("dataset.owner"),
  datasetMeta: Ember.computed("dataset.meta", function() {
    let meta = this.get("dataset.meta") || {},
    apiHost = this.get("dataset.store.name");
    if (apiHost)
      meta.apiHost = apiHost;
    return meta;
  }),

  actions: {
    toggleEditor() {
      this.toggleProperty('editorVisible');
    },
    mutateJson(json) {
      if (trace > 1)
        dLog('mutateJson()', 'currentMeta => ', this.get("currentMeta"));
      this.set("currentMeta", json);
      if (trace > 1)
        dLog('mutateJson()', 'currentMeta => ', this.get("currentMeta"));
      // this.get("dataset").save()
    },
    saveJSONToDB() {
      dLog('saveJSONToDB()', 'currentMeta', this.get("currentMeta"));
      this.set("dataset.meta", this.get("currentMeta"));
      this.get("dataset").save();
      this.send("toggleEditor");
    }
  },
});
