import Ember from 'ember';


/*----------------------------------------------------------------------------*/
/** factored out of :
 * @see services/api-servers.js : init()
 * @see adapters/application.js : host() 
 */


/** This is equivalent to :
 *  import ENV from '../../config/environment';
 * It can be used where that import is not possible, e.g. in an addon.
 * @param thisObject  Ember.Object, used to get owner, for resolveRegistration().
 */
function getConfiguredEnvironment(thisObject)
{
  /** from pretzel-local.js : authenticate() */
  let
    config = Ember.getOwner(thisObject).resolveRegistration('config:environment');
  return config;
};

/**
 * @param thisObject  Ember.Object, used to get owner, for registration
 */
function getSiteOrigin(thisObject)
{
  /** from services/api-servers.js : init() */
  let
  application = Ember.getOwner(thisObject).lookup('controller:application'),
  /** e.g.  'http://localhost:4200' */
  siteOrigin = application.target.location.concreteImplementation.location.origin;
  
  return siteOrigin;
};
/*----------------------------------------------------------------------------*/

export {
  getConfiguredEnvironment,
  getSiteOrigin
};
