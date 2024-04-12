import { computed } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';

import { _internalModel_data } from '../../utils/ember-devel';


const dLog = console.debug;

const trace = 1;

/**
 * Transient data objects (Features / Blocks / Datasets) which are
 * created in frontend and not persisted to server & database.  May be
 * added to store.
 *
 * Purpose : provide display of Features in similar ways to database
 * features, e.g. clickedFeatures as triangles.
 */

/**
 * Related : services/data/selected.js
 *
 * for #239 : FASTA / DNA sequence search API, display results in frontend
 * comment / section : multiple output tabs : 
 *  - after viewing the added dataset : also put them into the feature search so they are highlighted
 *  - display table rows as Feature triangles
 */
export default Service.extend({
  pathsPro : service('data/paths-progressive'),
  selected : service('data/selected'),
  apiServers: service(),

  store : alias('apiServers.serverSelected.store'),

  /*--------------------------------------------------------------------------*/

  pushFeature(f) {
    // pathsPro.pushFeature() will use default flowsService.
    return this.get('pathsPro').pushFeature(this.get('store'), f, /*flowsService*/undefined);
  },

  /*--------------------------------------------------------------------------*/

  pushData(store, modelName, d) {
    let c;
    let r = store.peekRecord(modelName, d._id);
    if (r) {
      // this can be a @param verifyFn : if (verifyFn) { verifyFn(d, r); }
      if (modelName === 'dataset') {
        // if ((r.parent !== d.parent) || (r.namespace !== d.namespace))
        dLog('peekRecord', modelName, d._id, d, r.get(_internalModel_data), r);
        dLog(r.parent,  d.parent,  r.namespace,  d.namespace);
      }
      c = r;
    }
    else
    {
      d.id = d._id;

      // .name is primaryKey of dataset
      let n = store.normalize(modelName, d);
      c = store.push(n);

      // if (trace > 2)
        dLog(c.get('id'), c.get(_internalModel_data));
    }
    return c;
  },

  /**
   * @param _id datasetName
   */
  datasetForSearch(_id, parent, namespace) {
    let
    d =
      {
        name : _id,
        _id, namespace, parent,
        tags : [ 'transient' ],
        meta : { paths : false }
      };
    return d;
  },

  pushDatasetArgs(_id, parent, namespace) {
    let
    data = this.datasetForSearch(_id, parent, namespace),
    store = this.get('store'),
    record = this.pushData(store, 'dataset', data);
    return record;
  },

  pushBlockArgs(datasetId, name, scope, namespace) {
    let
    /** may need to pass search ID also; depends on whether distinct blocks should be used for each search result. */
    /** prefix _id with datasetId to make it unique enough.  May use UUID. */
    data = {_id : datasetId + '-' + name, scope, name, namespace, datasetId},
    store = this.get('store'),
    record = this.pushData(store, 'block', data);
    return record;
  },
  /** Push into the (default) store blocks for the given datasetId and {name,scope,namespace}
   * @param blockNames, scopesForNames are parallel
   */
  blocksForSearch(datasetId, blockNames, scopesForNames, namespace) {
    let blocks = blockNames.map((name, i) =>
      this.pushBlockArgs(datasetId, name, scopesForNames[i], namespace));
    return blocks;
  },

  /**
   * @param active  true if the tab containing these results is (becoming) active
   * Features are displayed only while the tab is active, to separate
   * viewing of distinct result sets.
   * @param view a flag per-feature to enable display of the feature row;
   * from values of the View checkbox column of the results features table.
   */
  showFeatures(dataset, blocks, features, active, view) {
    let
    selected = this.get('selected'),
    // may pass dataset, blocks to pushFeature()
    stored = features.map((f) => this.pushFeature(f));
    stored.forEach((feature, i) => this.showFeature(feature, active && view[i]));
  },
  showFeature(feature, viewFeaturesFlag) {
    let
    selected = this.get('selected');
    selected.toggle('features', feature, viewFeaturesFlag);
    selected.toggle('labelledFeatures', feature, viewFeaturesFlag);
    }

});
