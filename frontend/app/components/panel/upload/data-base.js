import Ember from 'ember';

const { Component, inject: { service } } = Ember;

export default Ember.Component.extend({
  session: service('session'),
  auth: service('auth'),
  store: Ember.inject.service(),

  actions: {
    submitForm() {
      let f = this.get('file');
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
          }, function(err, status) {
            console.log(err.responseJSON.error);
            that.setProperties({
              isProcessing: false, 
              errorMessage: err.responseJSON.error.message,
              successMessage: null
            });
            $("body").animate({ scrollTop: 0 }, "slow");
          });
        }
        reader.readAsBinaryString(f);
        this.setProperties({
          isProcessing: true
        })
      }
    }
  }
});
