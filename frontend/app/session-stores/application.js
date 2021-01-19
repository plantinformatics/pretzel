import Cookie from 'ember-simple-auth/session-stores/cookie';

console.log('session-stores/application.js', 'Cookie.cookieDomain', document.domain);

export default Cookie.extend({
  cookieDomain : document.domain
});
