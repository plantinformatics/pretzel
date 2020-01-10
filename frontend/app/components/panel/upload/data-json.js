import UploadBase from './data-base';

export default UploadBase.extend({
  actions: {
    submitFile() {
      let f = this.get('file');
      if (f && !this.get('isProcessing')) {
        let reader = new FileReader();
        var that = this;
        reader.onload = function(e) {
          let data = {data: reader.result, fileName: f.name};
          that.get('auth').uploadData(data, that.updateProgress.bind(that))
          .then(function(res){
            that.setSuccess();
            that.scrollToTop();
            // On complete, trigger dataset list reload
            // through controller-level function
            that.get('refreshDatasets')();
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
            that.setError(errmsg);
            that.scrollToTop();
          });
        };
        reader.readAsBinaryString(f);
        this.setProcessing();
        this.scrollToTop();
      }
    }
  }
});
