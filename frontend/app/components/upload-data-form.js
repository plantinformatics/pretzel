import Ember from 'ember';

const { inject: { service }, Component } = Ember;

export default Component.extend({
  session: service('session'),
  auth: service('auth'),

  actions: {
    submitForm() {
      let f = this.get('file');
      if (f && !this.get('isProcessing')) {
        let reader = new FileReader();
        var that = this;
        reader.onload = function(e) {
          that.get('auth').uploadData({data: reader.result, fileName: f.name})
          .then(function(res){
            that.setProperties({
              isProcessing: false, 
              successMessage: "Geneticmap data uploaded successfully!",
              errorMessage: null
            })
          }, function(err, status) {
            console.log(err.responseJSON.error)
            that.setProperties({
              isProcessing: false, 
              errorMessage: err.responseJSON.error.message,
              successMessage: null
            })
          });
        }
        reader.readAsBinaryString(f);
        this.setProperties({
          isProcessing: true
        })
      }
    },
    upload(e) {
      let files = e.target.files;
      this.set('file', null);
      if (files.length > 0) {
        this.set('file', files[0]);
      }
    }
  }
});
