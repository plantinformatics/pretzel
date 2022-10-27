import { inject as service } from '@ember/service';

const dLog = console.debug;

import UploadBase from './data-base';

/*----------------------------------------------------------------------------*/

/** Convert ArrayBuffer to String, using single-char operations.
 */
function arrayBufferToString1Char(buffer) {
  /* Based on https://stackoverflow.com/a/60782610 Anthony O.
   * Similar using reduce() : https://stackoverflow.com/a/60301316
   */
  let binary = '';
  let bytes = new Uint8Array(buffer);
  let len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}


/** Convert ArrayBuffer to String, using 2^16 Byte chunks.
 * from : https://stackoverflow.com/a/20604561 Ryan Weinstein
 * "... about 20 times faster than using blob. It also works for large strings of over 100mb."
 */
function arrayBufferToString(buffer){
  var bufView = new Uint8Array(buffer);
  var length = bufView.length;
  var result = '';
  var addition = Math.pow(2,16)-1;

  for (var i = 0; i < length; i += addition) {
    if (i + addition > length) {
      addition = length - i;
    }
    result += String.fromCharCode.apply(null, bufView.subarray(i, i + addition));
  }

  return result;
}


/*----------------------------------------------------------------------------*/


export default UploadBase.extend({
  apiServers : service(),
  blockService : service('data/block'),

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
      data = arrayBufferToString(buffer),
      replaceDataset = this.replaceDataset,
      /** corresponds to the param msg in backend/common/models/dataset.js : upload(). */
      message = {fileName, data, replaceDataset};
      this.set('warnings', []);
      this.set('errors', []);
      /** a jQuery promise (jqXHR) */
      let promise =
      this.uploadData(message);
      // .uploadData() .then( , onRejected) does .setError()
      promise.always(() => file.queue.remove(file));
      /** data-base:uploadData() calls setSuccess() (i.e. 'Uploaded successfully')
       * Prepend the datasetName to that message.
       */
      promise.then((res) => {
        const status = res.status;
        let datasetNames;
        if (status.datasetNames) {
          datasetNames = status.datasetNames;
        } else {
          datasetNames = [status];
        }
        datasetNames.forEach((datasetName) => this.unviewDataset(datasetName));
        this.setSuccess("Dataset '" + datasetNames.join("', '") + "' " +  this.successMessage);
        this.set('warnings', status?.warnings || []);
        this.set('errors', status?.errors || []);
        this.get('blockService').featureSaved();
      });
    });

  },

  /** Unview the blocks of the dataset which has been replaced by successful upload.
   */
  unviewDataset(datasetName) {
    let
    store = this.get('apiServers').get('primaryServer').get('store'),
    replacedDataset = store.peekRecord('dataset', datasetName);
    if (replacedDataset) {
      let
      viewedBlocks = replacedDataset.get('blocks').toArray().filterBy('isViewed'),
      blockService = this.get('blockService'),
      blockIds = viewedBlocks.map((b) => b.id);
      dLog('unviewDataset', datasetName, blockIds);
      blockService.setViewed(blockIds, false);
    }
  }

});
