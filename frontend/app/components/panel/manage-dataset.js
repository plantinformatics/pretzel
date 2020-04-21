import ManageBase from './manage-base';
import Ember from 'ember';

/** @param: dataset **/

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
      console.log('currentMeta => ', this.get("currentMeta"));
      this.set("currentMeta", json);
      console.log('currentMeta => ', this.get("currentMeta"));
      // this.get("dataset").save()
    },
    saveJSONToDB() {
      this.set("dataset.meta", this.get("currentMeta"));
      this.get("dataset").save();
      this.send("toggleEditor");
    }
  },
});
