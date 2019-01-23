import ManageBase from './manage-base';


/** @param: dataset **/

export default ManageBase.extend({
  datasetMeta: Ember.computed("dataset.meta", function() {
    return this.get("dataset.meta") || {}
  }),
  actions: {
    mutateJson(json) {
      this.set("dataset.meta", json)
      console.log('this.get("dataset.meta") => ', this.get("dataset.meta"))

      // this.get("dataset").save()
    },
    saveToDB() {
      this.get("dataset").save()
    }
  },
  
});
