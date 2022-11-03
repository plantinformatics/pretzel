import UploadBase from './data-base';

/* global FileReader */

export default UploadBase.extend({
  actions: {
    submitFile() {
      let f = this.get('file');
      if (f && !this.get('isProcessing')) {
        let reader = new FileReader();
        var that = this;
        reader.onload = function(e) {
          let data = {data: reader.result, fileName: f.name};
          that.uploadData(data);
        };
        reader.readAsBinaryString(f);
        this.setProcessing();
        this.scrollToTop();
      }
    }
  }
});
