import { computed } from '@ember/object';
import Component from '@ember/component';

export default Component.extend({

  errorMessageIsMultiline : computed('errorMessage', function () {
    let message = this.get('errorMessage'),
        multiline = message && message.split(/\n/).length > 2;
    return multiline;
  })

});
