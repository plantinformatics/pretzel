import UploadBase from './upload-data-base'

export default UploadBase.extend({
  actions: {
    upload(e) {
      let files = e.target.files;
      this.set('file', null);
      if (files.length > 0) {
        this.set('file', files[0]);
      }
    }
  }
});
