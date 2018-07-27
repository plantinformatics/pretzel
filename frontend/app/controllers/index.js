import Ember from 'ember';
import DS from 'ember-data';

/*----------------------------------------------------------------------------*/

/** path of site-specific HTML file to insert into the landing page.
 * For 'ember server' this is relative to frontend/public/
 * The attribute name of the promise and the file base name need not be the same.
 */
let siteSpecificHtmlUrl = 'landingPageContent.html';
/** HTML to show in place of the site-specific file if there is none.
 * The template can wrap this with e.g. <div style="display:none;">...</div>.
 */
let alternateHtml =
  "To allow use-specific customisation, content can be loaded into this \
position, from a file separate from the source repository. The html is loaded \
from this file : " + siteSpecificHtmlUrl + ", if available; when using 'ember server' \
it will be in this path : frontend/public/ ";

export default Ember.Controller.extend({

  landingPageContent: Ember.computed( function () {
    let me = this;
    return DS.PromiseObject.create({
      promise:
      new Ember.RSVP.Promise(function (resolve, reject) {
        Ember.$.ajax({
          url: siteSpecificHtmlUrl,
          method: 'GET',
          success: function (html) {
            console.log(siteSpecificHtmlUrl, html.length);
            resolve(html);
          },
          error: function (jqXHR, statusText, error) {
            let callbackContext = this,
            message = 'Optional customisable html file ' + siteSpecificHtmlUrl
             + ' "' + error + '"' + ', url=' + callbackContext.url;
            console.log(message, 'error=', error);
            reject(message + ".\n      " + alternateHtml);
          }
        });
      })
    });
  })


});
