import ManageBase from './manage-base';


/** @param: dataset **/

export default ManageBase.extend({
  editorVisible: false,
  currentMeta: {},

  ownedByMe: Ember.computed.alias("dataset.owner"),
  datasetMeta: Ember.computed("dataset.meta", function() {
    return this.get("dataset.meta") || {}
  }),

  actions: {
    toggleEditor() {
      this.toggleProperty('editorVisible');
    },
    mutateJson(json) {
      console.log('currentMeta => ', this.get("currentMeta"));
      this.set("currentMeta", json)
      console.log('currentMeta => ', this.get("currentMeta"));
      // console.log('this.get("dataset.meta") => ', this.get("dataset.meta"))

      // this.get("dataset").save()
    },
    saveJSONToDB() {
      this.set("dataset.meta", this.get("currentMeta"))
      this.get("dataset").save()
      this.send("toggleEditor")
    }
  },
  
});
