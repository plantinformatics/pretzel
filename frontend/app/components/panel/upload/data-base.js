import Ember from 'ember';

const { Component, inject: { service } } = Ember;

export default Ember.Component.extend({
  session: service('session'),
  auth: service('auth'),
  store: Ember.inject.service(),
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
  }
});
