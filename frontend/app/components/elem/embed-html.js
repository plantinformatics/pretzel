import { later } from '@ember/runloop';
import { getOwner } from '@ember/application';
import $ from 'jquery';
import { alias } from '@ember/object/computed';
import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import Component from '@ember/component';

/*----------------------------------------------------------------------------*/
/* Dev notes : 
 *
 * When using 'ember server', the fileUrl needs to include the API port;
 * fileUrl is prefixed with apiHost (in promise()) to handle that.
 *
 * Any images refrenced from <img src> in those content html pages will have the
 * ember server port in their URL, instead of the API port, so they won't load.
 *
 * Copy the landingPageContent and signupPageContent into frontend/dist/
 * This is cleared by 'ember build' and by each build cycle of 'ember server',
 * so copy the content into dist/ again.
 * When copying the content from pretzel-landing-page/, there is no need to copy .git/, so rsync --exclude can be used, e.g. :
 * serveHtml=frontend/dist
 * [ -d $serveHtml/landingPageContent ] || rsync -a --exclude='.git' ../pretzel-landing-page/ $serveHtml/landingPageContent
 * That form, with / appended to the source dir, will also effect the rename from pretzel-landing-page/ to landingPageContent/
 *
 * If the frontend/dist/*Content/ is not present, then the loopback/express backend will try appending /, e.g.  :
 * http://localhost:5000/landingPageContent/index.html  -> 
 * http://localhost:5000/landingPageContent/index.html/
 *
 * After copying in the content, the above may still happen if the browser is caching the result
 * using wget / curl can bypass that cache;  also adding // to the path, e.g. :
 * http://localhost:5000/signupPageContent//index.html
 *
 * 
 */

/*----------------------------------------------------------------------------*/


/* not used; siteSpecificHtmlUrl is moved into the Component. */
/** HTML to show in place of the site-specific file if there is none.
 * The template can wrap this with e.g. <div style="display:none;">...</div>.
 */
const alternateHtml =
  "To allow use-specific customisation, content can be loaded into this \
position, from a file separate from the source repository. The html is loaded \
from this file : " + '' /*siteSpecificHtmlUrl*/ + ", if available; when using 'ember server' \
it will be in this path : frontend/public/ ";

/**
 * @param path  e.g. "landingPageContent/"
*/
export default Component.extend({
  ajax: service(),

  classNames: ['embedHtml'],

  /** path of site-specific HTML file to insert into the landing page.
   * For 'ember server' this is relative to frontend/public/
   * The attribute name of the promise and the file base name need not be the same.
   * Loopback will map this to a directory by appending /, and load index.html from that directory.
   */
  siteSpecificHtmlUrl : computed('path', function () {
    let index = 'index.html',
    path = this.get('path');
    if (path)
      index = path + '/' + index;
    return index;
  }),

  landingPageContentFileName : alias('siteSpecificHtmlUrl'),

  willRender : function () {
    console.log('willRender', this.get('landingPageContentFileName'));
    /* This .remove() is probably not required now that the promise result is
     * inserted via {{await}} in the hbs.
     * Commented out - can be deleted if all OK.
     */
    /** Each time the user clicks to another route and back, another copy of
     * landingPageContent is inserted.  A rough solution is to remove any
     * pre-existing content when entering this route.  That also prevents the
     * landingPageContent from appearing on the signup and login pages.
     * A more structured solution might be factor the pre-landingPageContent
     * functionality out of index.js to base.js which index.js,
     * signup, login can inherit.
     */
    let previousContent = $('div.landingPageContent');
    console.log('willRender', previousContent.length, previousContent.length && previousContent[0]);
    // previousContent.remove();
  },
  
  promise: computed('landingPageContentFileName', function () {
    let me = this;
    let fileUrl = this.get('landingPageContentFileName');
    /** If origin port is different to API port, then prefix fileUrl with apiHost.
     * This is required when using 'ember server', because it is on a different port than the API.
     * This may work in all cases, but it is not required when the app is served from the API port.
     * This is similar to @see services/auth.js:._endpoint().
     */
    let config = getOwner(this).resolveRegistration('config:environment');
    // e.g. "http://localhost:4200" !== "http://localhost:5000"
    if (document.location.origin !== config.apiHost)
      fileUrl = config.apiHost + '/' + fileUrl;
    console.log('landingPageContentFileName', fileUrl);

      let promise = this.get('ajax').request(fileUrl, {
        method: 'GET',
        dataType: 'html',
        contentType: 'text/html; charset=utf-8',
        'Accept': 'text/html'
      });
    let path = this.get('path');
    if (path)
    promise.then(function (html) {
      console.log(fileUrl, html.length);
      /* <img> src will need path inserted; the following can do that automatically,
       * but perhaps better atm to manually edit the path in index.html to match the
       * installed location (e.g. landingPageContent/).
       *
       * This is done in .later() to wait for the html content to be inserted.
       * See also the note above about 'ember server' : the img src URL is relative
       * to the port of the ember server, not the API, so imgs won't load.
       */
      if (false)
      later(function () {
        let imgs = $('#Page-Body > .ember-view.embedHtml img');
        imgs.attr('src', function (index, val) { return val.replace(/^/, path + '/'); });
      });
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
