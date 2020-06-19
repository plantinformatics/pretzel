import Ember from 'ember';
import DS from 'ember-data';
import attr from 'ember-data/attr';
const { inject: { service } } = Ember;

import Record from './record';


const dLog = console.debug;

export default Record.extend({
  apiServers : service(),

  name: attr('string'),

  parent : Ember.computed(
    'parentName',
    'apiServers.serversLength',
    'apiServers.datasetsBlocksRefresh',
    'meta.referenceHost',
    function () {
      let parentName = this.get('parentName'),
      parent;
      if (parentName) {
        let
          apiServers = this.get('apiServers'),
        datasets = apiServers.dataset2stores(parentName);
        if (datasets.length === 0) {
          dLog(this.id, 'parent', parentName, 'no match');
        } else if (datasets.length === 1) {
          parent = datasets[0].dataset;
        } else {  // (datasets.length > 1)
          dLog(this.id, 'parent', parentName, 'multiple match', datasets);
          /** If the user has indicated a preference via 'meta.referenceHost', use that.  */
          let referenceHost = this.get('meta.referenceHost');
          if (referenceHost) {
            /** could use .includes() to treat referenceHost as a fixed string instead of a regexp. */
            let preferred = datasets.filter((d) => d.server.host.match(referenceHost));
            if (preferred.length) {
              dLog('parent', 'preferred count', preferred.length, preferred);
              parent = preferred[0].dataset;
            }
          }
          if (! parent) {
            /** prefer to use a dataset from its original source, rather than a copy
             * cached in primary server */
            let original = datasets.filter((d) => ! d.dataset.get('meta.origin'));
            if (original.length) {
              dLog('parent', 'original count', original.length, original);
              parent = original[0].dataset;
            }
            else {
              /** perhaps at this point, prefer the host/server/store which this dataset is from. */
              let sameServer = datasets.filter((d) => d.store === this.store);
              if (sameServer.length) {
                dLog('parent', 'sameServer count', sameServer.length, sameServer);
                parent = sameServer[0].dataset;
              }
              else
                /* use the first in the list, this is probably the primary;
                 * user can be given control of this selection by setting meta.referenceHost
                 */
                parent = datasets[0].dataset;
            }
          }
        }
        dLog(this.id, 'parent', parentName, parent);
      }
      return parent;
    }),

  parentName: DS.attr(), // belongsTo('dataset', {inverse: 'children'}),
  // children: DS.hasMany('dataset', {inverse: 'parent'}),

  blocks: DS.hasMany('block', { async: false }),
  type: attr('string'),
  namespace: attr('string'),
  tags: attr('array'),
  meta: attr(),

  /*--------------------------------------------------------------------------*/

  /** is this dataset copied from a (secondary) server, cached on the server it was loaded from (normally the primary). */
  isCopy : Ember.computed('meta.origin', function () {
    return !! this.get('meta.origin');
  })

  /*--------------------------------------------------------------------------*/

});
