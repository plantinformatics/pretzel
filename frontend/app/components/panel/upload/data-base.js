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

  setProcessing() {
    this.setProperties({
      isProcessing: true,
      successMessage: null,
      errorMessage: null,
      warningMessage: null
    });
  },
  setSuccess(msg) {
    let response = msg ? msg : 'Uploaded successfully';
    response += ` from file "${this.get('file').name}"`;
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
  scrollToTop() {
    $("#left-panel-upload").animate({ scrollTop: 0 }, "slow");
  },

  actions: {
    setFile(e) {
      let files = e.target.files;
      this.set('file', null);
      if (files.length > 0) {
        this.set('file', files[0]);
      }
    },
  }
});
