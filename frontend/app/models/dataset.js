import { computed } from '@ember/object';
import { inject as service } from '@ember/service';
import { attr, hasMany } from '@ember-data/model';

import Record from './record';


const dLog = console.debug;
const trace = 1;

export default Record.extend({
  apiServers : service(),

  name: attr('string'),

  parent : computed(
    'parentName',
    'apiServers.serversLength',
    'apiServers.datasetsBlocksRefresh',
    '_meta.referenceHost',
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
          /** If the user has indicated a preference via '_meta.referenceHost', use that.  */
          let referenceHost = this.get('_meta.referenceHost');
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
            let original = datasets.filter((d) => ! d.dataset.get('_meta._origin'));
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
                 * user can be given control of this selection by setting _meta.referenceHost
                 */
                parent = datasets[0].dataset;
            }
          }
        }
        if (trace > 1)
          dLog(this.id, 'parent', parentName, parent);
      }
      return parent;
    }),

  parentName: attr(), // belongsTo('dataset', {inverse: 'children'}),
  // children: DS.hasMany('dataset', {inverse: 'parent'}),
  children : computed('parentName', function children () {
    let c = this.store.peekAll('dataset')
      .filterBy('parentName', this.get('id'));
    return c;
  }),

  blocks: hasMany('block', { async: false }),
  type: attr('string'),
  namespace: attr('string'),
  tags: attr('array'),
  _meta: attr(),

  /*--------------------------------------------------------------------------*/

  /** is this dataset copied from a (secondary) server, cached on the server it was loaded from (normally the primary). */
  isCopy : computed('_meta._origin', function () {
    return !! this.get('_meta._origin');
  }),

  /** same as .blocks, with any blocks copied from a secondary server filtered out.
   */
  blocksOriginal : computed('blocks.[]', function () {
    let blocks = this.get('blocks')
      .filter((b) => ! b.get('isCopy'));
    return blocks;
  })

  /*--------------------------------------------------------------------------*/

});
