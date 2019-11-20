import Ember from 'ember';

const { Component, inject: { service } } = Ember;

export default Ember.Component.extend({
  session: service('session'),
  auth: service('auth'),
  store: Ember.inject.service(),

  actions: {
    submitForm() {
      let f = this.get('file');
      // Controller-level function that reloads dataset list
      let refreshDatasets = this.get('refreshDatasets');
      if (f && !this.get('isProcessing')) {
        let reader = new FileReader();
        var that = this;
        reader.onload = function(e) {
          let data = {data: reader.result, fileName: f.name};
          that.get('auth').uploadData(data)
          .then(function(res){
            that.setProperties({
              isProcessing: false, 
              successMessage: "Dataset uploaded successfully!",
              errorMessage: null
            });
            $("body").animate({ scrollTop: 0 }, "slow");
            // On complete, trigger dataset list reload
            refreshDatasets();
          }, function(err, status) {
            let errobj = err.responseJSON.error;
            console.log(errobj);
            let errmsg = null;
            if (errobj.message) {
              errmsg = errobj.message;
            } else if (errobj.errmsg) {
              errmsg = errobj.errmsg;
            } else if (errobj.name) {
              errmsg = errobj.name;
            }
            that.setProperties({
              isProcessing: false, 
              errorMessage: errmsg,
              successMessage: null
            });
            $("body").animate({ scrollTop: 0 }, "slow");
          });
        };
        reader.readAsBinaryString(f);
        this.setProperties({
          isProcessing: true
        });
      }
    }
  }
});
