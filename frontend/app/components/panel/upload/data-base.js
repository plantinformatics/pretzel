import Component from '@ember/component';
import { inject as service } from '@ember/service';

const dLog = console.debug;

export default Component.extend({
  session: service('session'),
  auth: service('auth'),
  store: service(),
  file: null,
  isProcessing: false,
  successMessage: null,
  errorMessage: null,
  warningMessage: null,
  progressMsg: '',

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
  scrollToTop() {
    $("#left-panel-upload").animate({ scrollTop: 0 }, "slow");
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

  actions: {
    setFile(e) {
      let files = e.target.files;
      this.set('file', null);
      if (files.length > 0) {
        this.set('file', files[0]);
        this.clearMsgs();
      }
    },
  },

  /**
   * @param data {fileName, data}
   * @return promise of completion of ajax API operation.
   * This is a jQuery promise, jqXHR. refn https://api.jquery.com/jquery.ajax/.
   *
   * This promise does not include the refreshDatasets API request
   * which this function performs after this promise completes.
   */
  uploadData(data) {
    const fnName = 'uploadData';
    let promise = 
    this.get('auth').uploadData(data, this.updateProgress.bind(this));
    promise
      .then((res) => {
        this.setSuccess();
        this.scrollToTop();
        // On complete, trigger dataset list reload
        // through controller-level function
        this.get('refreshDatasets')();
      }, (err, status) => {
        let errobj = err.responseJSON?.error;
        console.log(fnName, errobj);
        let errmsg = null;
        if (! errobj) {
          if (err.responseJSON) {
            errmsg = err.responseJSON;
          } else if (err.statusText) {
            errmsg = fnName + ' : ' + err.statusText + ' : ' + err.state?.() + ', ' + err.status;
          } else {
            /* i.e. err.toString(); if err is Object, this produces
             * "[object Object]", which is not useful */
            errmsg = '' + err;
          }
        } else
        if (errobj.message) {
          errmsg = errobj.message;
        } else if (errobj.errmsg) {
          errmsg = errobj.errmsg;
        } else if (errobj.name) {
          errmsg = errobj.name;
        }
        this.setError(errmsg);
        this.setProperties({isProcessing: false});
        this.scrollToTop();
      });
    return promise;
  }

});
