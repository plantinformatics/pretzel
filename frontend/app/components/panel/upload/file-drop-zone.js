
const dLog = console.debug;

import UploadBase from './data-base';

export default UploadBase.extend({

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

    var bufferPromise = blob.arrayBuffer();
    blob.arrayBuffer().then((buffer) => {
      /* process the ArrayBuffer */
      dLog('arrayBuffer', buffer, buffer.byteLength);
      let data = {fileName : file.name, data : String.fromCharCode.apply(null, new Uint8Array(buffer)) };
      this.uploadData(data);
    });

  }

});
