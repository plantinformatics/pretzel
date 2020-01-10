import Ember from 'ember';
import DS from 'ember-data';

/*----------------------------------------------------------------------------*/

/** path of site-specific HTML file to insert into the signup page.
 * For 'ember server' this is relative to frontend/public/
 * The attribute name of the promise and the file base name need not be the same.
 * Loopback will map this to a directory by appending /, and load signu.html from that directory.
 */
const siteSpecificSignupHtmlUrl = 'landingPageContent/signup.html';
/** HTML to show in place of the site-specific file if there is none.
 * The template can wrap this with e.g. <div style="display:none;">...</div>.
 */
const alternateHtml =
  "To allow use-specific customisation, content can be loaded into this \
position, from a file separate from the source repository. The html is loaded \
from this file : " + siteSpecificSignupHtmlUrl + ", if available; when using 'ember server' \
it will be in this path : frontend/public/ ";

export default Ember.Controller.extend({
  ajax: Ember.inject.service(),

  signupPageContentFileName : siteSpecificSignupHtmlUrl,

  willRender : function () {
    console.log('willRender', this.get('signupPageContentFileName'));
    /** Each time the user clicks to another route and back, another copy of
     * signupPageContent is inserted.  A rough solution is to remove any
     * pre-existing content when entering this route.  That also prevents the
     * signupPageContent from appearing on the signup and login pages.
     * A more structured solution might be factor the pre-signupPageContent
     * functionality out of signup.js to base.js which signu.js,
     * signup, login can inherit.
     */
    let previousContent = Ember.$('div.signupPageContent');
    previousContent.remove();
  },
  
  signupPageContent: Ember.computed('signupPageContentFileName', function () {
    let me = this;
    let fileUrl = this.get('signupPageContentFileName');
    console.log('signupPageContentFileName', fileUrl);

      let promise = this.get('ajax').request(fileUrl, {
        method: 'GET',
        dataType: 'html',
        contentType: 'text/html; charset=utf-8',
        'Accept': 'text/html'
      });
    promise.then(function (html) {
      console.log(fileUrl, html.length);
    });
    promise.catch(
      function (/*jqXHR, statusText,*/ error) {
        let callbackContext = this,
        message = 'Optional customisable html file ' + fileUrl
          + ' "' + error + '"' + ', url=' + callbackContext.url;
        console.log(message, 'error=', error);
        // reject(message + ".\n      " + alternateHtml);
      }
    );
    return promise;
  })


});
