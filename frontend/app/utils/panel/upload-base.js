
/**
 * factored from components/panel/upload/data-base.js
 * May evolve this to a decorator or a sub-component.
 *
 * usage :
 *
  // file: null,  // not required
  isProcessing: false,
  successMessage: null,
  errorMessage: null,
  warningMessage: null,
  progressMsg: '',

 */

export default {


  setProcessing() {
    this.updateProgress(0, 'up');
    this.setProperties({
      isProcessing: true,
      successMessage: null,
      errorMessage: null,
      warningMessage: null
    });
  },
  setSuccess(msg) {
    let response = msg ? msg : 'Uploaded successfully';
    /** .file is undefined (null) when data is read from table instead of from file */
    let file = this.get('file');
    if (file)
      response += ` from file "${file.name}"`;
    this.setProperties({
      isProcessing: false,
      successMessage: response,
    });
  },
  setError(msg) {
    this.setProperties({
      isProcessing: false,
      errorMessage: msg,
    });
  },
  setWarning(msg) {
    this.setProperties({
      isProcessing: false,
      successMessage: null,
      errorMessage: null,
      warningMessage: msg,
    });
  },
  clearMsgs() {
    this.setProperties({
      successMessage: null,
      errorMessage: null,
      warningMessage: null,
    });
  },

  /** Callback used by data upload, to report progress percent updates */
  updateProgress(percentComplete, direction) {
    if (direction === 'up') {
      if (percentComplete === 100) {
        this.set('progressMsg', 'Please wait. Updating database.');
      } else {
        this.set('progressMsg',
          'Please wait. File upload in progress (' +
            percentComplete.toFixed(0) + '%)' );
      }
    } else {
      this.set('progressMsg',
        'Please wait. Receiving result (' + percentComplete.toFixed(0) + '%)' );
    }
  },


};
