import Cookie from 'ember-simple-auth/session-stores/cookie';

export default Cookie.extend({
  /** the default cookieName 'ember_simple_auth-session' encounters intermittent
   * problems in Chrome (non-incognito mode) with the authentication token not
   * being written into the cookie; appears to be related to the presence of '-'
   * in the cookie name, maybe because of a hyphen in the cookie value :
   * pretzel-local.  Works on some servers and not others; it is seen in
   * sub-domain servers, and related to interference from the cookie set by the
   * parent domain;  may be related to nginx config.
   * The issue is that after login OK, it starts to display the mapview route,
   * then bounces back to login, possibly when the 500msec _syncDataTimeout
   * occurs (ember-simple-auth/addon/session-stores/cookie.js)
   * This change in cookieName from '-' to '_' in fixes it.
   */
  cookieName : 'ember_simple_auth_session'
});
