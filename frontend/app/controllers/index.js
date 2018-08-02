import Ember from 'ember';
import DS from 'ember-data';

/*----------------------------------------------------------------------------*/

/** path of site-specific HTML file to insert into the landing page.
 * For 'ember server' this is relative to frontend/public/
 * The attribute name of the promise and the file base name need not be the same.
 * Loopback will map this to a directory by appending /, and load index.html from that directory.
 */
const siteSpecificHtmlUrl = 'landingPageContent/index.html';
/** HTML to show in place of the site-specific file if there is none.
 * The template can wrap this with e.g. <div style="display:none;">...</div>.
 */
const alternateHtml =
  "To allow use-specific customisation, content can be loaded into this \
position, from a file separate from the source repository. The html is loaded \
from this file : " + siteSpecificHtmlUrl + ", if available; when using 'ember server' \
it will be in this path : frontend/public/ ";

export default Ember.Controller.extend({
  ajax: Ember.inject.service(),

  landingPageContentFileName : siteSpecificHtmlUrl,

  landingPageContent: Ember.computed('landingPageContentFileName', function () {
    let me = this;
    let fileUrl = this.get('landingPageContentFileName');
    console.log('landingPageContentFileName', fileUrl);

      let promise = this.get('ajax').request(fileUrl, {
        method: 'GET',
        dataType: 'html',
        contentType: 'text/html; charset=utf-8',
        'Accept': 'text/html'
      });
    promise.then(function (html) {
      console.log(fileUrl, html.length);
      /* <img> src will need path landingPageContent/, but perhaps better to edit the
       * index.html when it is installed.  */
      if (false) {
        let imgs = Ember.$('.ember-view table img');
        imgs.attr('src', function (index, val) { return val.replace(/^/, 'landingPageContent/'); });
      }
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
