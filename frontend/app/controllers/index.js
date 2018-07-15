import Ember from 'ember';
import DS from 'ember-data';

/*----------------------------------------------------------------------------*/

/** path of site-specific HTML file to insert into the landing page.
 * For 'ember server' this is relative to frontend/public/
 */
let siteSpecificHtmlUrl = 'logosEtc.html';
/** HTML to show in place of the site-specific file if there is none.  */
let alternateHtml =
  "<!-- To allow use-specific customisation, content can be loaded into this \
position, from a file separate from the source repository. The html is loaded \
from this path, if available : frontend/public/logosEtc.html -->";

export default Ember.Controller.extend({

  logosEtc: Ember.computed( function () {
    let me = this;
    return DS.PromiseObject.create({
      promise:
      new Ember.RSVP.Promise(function (resolve, reject) {
        Ember.$.ajax({
          url: siteSpecificHtmlUrl,
          method: 'GET',
          success: function (html) {
            console.log('logosEtc', html.length);
            resolve(html);
            // me.set('logosEtcProperty', html);
          },
          error: function (jqXHR, statusText, error) {
            let callbackContext = this;
            console.log('logosEtc file not read', siteSpecificHtmlUrl,
            'statusText=', statusText, 'error=', error, 'url=', callbackContext.url);
            resolve(alternateHtml);
            // reject();
          }
        });
      })
    });
  })


});
