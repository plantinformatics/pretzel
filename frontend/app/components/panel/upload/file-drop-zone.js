
const dLog = console.debug;

import UploadBase from './data-base';

export default UploadBase.extend({

  replaceDataset : true,

  uploadSpreadsheet(file) {
    const
    blob = file.blob,
    queue = file.queue;
    dLog(
      'uploadSpreadsheet', file.name,
      blob.size,
      blob.type,
      blob.lastModifiedDate,
      blob.lastModified,
      queue
    );

    this.setProcessing();
    this.scrollToTop();

    var bufferPromise = blob.arrayBuffer();
    blob.arrayBuffer().then((buffer) => {
      /* process the ArrayBuffer */
      dLog('arrayBuffer', buffer, buffer.byteLength);
      const
      fileName = file.name,
      data = String.fromCharCode.apply(null, new Uint8Array(buffer)),
      replaceDataset = this.replaceDataset,
      /** corresponds to the param msg in backend/common/models/dataset.js : upload(). */
      message = {fileName, data, replaceDataset};
      /** a jQuery promise (jqXHR) */
      let promise =
      this.uploadData(message);
      promise.always(() => file.queue.remove(file));
      /** data-base:uploadData() calls setSuccess() (i.e. 'Uploaded successfully')
       * Prepend the datasetName to that message.
       */
      promise.then((res) => {
        let datasetName = res.status;
        this.setSuccess("Dataset '" + datasetName + "' " +  this.successMessage);
      });
    });

  }

});
