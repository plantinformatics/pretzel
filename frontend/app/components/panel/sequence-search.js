import Component from '@ember/component';
import { bind, once, later, throttle } from '@ember/runloop';
import { inject as service } from '@ember/service';
import { computed } from '@ember/object';


const dLog = console.debug;

export default Component.extend({
  auth: service(),

  classNames: ['col-xs-12'],
  // actions
  actions: {
    // copied from feature-list, may not be required
    inputIsActive() {
      dLog('inputIsActive');
    },
    paste: function(event) {
      console.log('paste', event);
      /** this action function is called before jQuery val() is updated. */
      later(() => {
        this.dnaSequenceInput();
      }, 500);
    },

    dnaSequenceInput(text, event) {
      dLog("dnaSequenceInput", this, text.length, event.keyCode);
      this.set('text', text);
      throttle(this.get('dnaSequenceInputBound'), 2000);
    }

  },
  /** throttle depends on constant function  */
  dnaSequenceInputBound : computed(function() {
    return bind(this, this.dnaSequenceInput);
  }),

  dnaSequenceInput(rawText) {
    rawText = this.get('text');
    // dLog("dnaSequenceInput");

    /*
    let
      text$ = $('textarea', this.element),
      /** before textarea is created, .val() will be undefined. */
      // rawText = text$.val();
      if (rawText)
      {
        let
        seq = rawText;
	/*
          .replaceAll(/[ \n\t]+/g, "")
          .toLowerCase();
	*/
        dLog("dnaSequenceInput", seq);
        let
        /** based on serverTabSelected or primary */
        apiServer = this.get('controls.apiServerSelectedOrPrimary'),
        auth = this.get('auth'),
        parent = "Triticum_aestivum_IWGSC_RefSeq_v1.0",
        searchType = 'blast',
        promise = auth.dnaSequenceSearch(
          apiServer,
          seq, parent, searchType,
          /*options*/{/*dataEvent : receivedData, closePromise : taskInstance*/});

        promise.then((data) => {
          dLog('dnaSequenceInput', data.features.length);
          this.set('data', data.features); } );
    }
  }

});
