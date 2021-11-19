import { computed } from '@ember/object';
import Service, { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';

import ObjectProxy from '@ember/object/proxy';
import PromiseProxyMixin from '@ember/object/promise-proxy-mixin';
import { resolve, all } from 'rsvp';

import EntryBase from './entry-base';

import { typeMetaIdChildrenTree  } from '../../utils/value-tree';
import { thenOrNow } from '../../utils/common/promises';

/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

const cropOntologyRoots = [
  {id : 'CO_366', name : 'Bambara groundnut'},
  {id : 'CO_325', name : 'Banana'},
  {id : 'CO_323', name : 'Barley'},
  {id : 'CO_333', name : 'Beet Ontology'},
  {id : 'CO_345', name : 'Brachiaria'},
  {id : 'CO_348', name : 'Brassica'},
  {id : 'CO_334', name : 'Cassava'},
  {id : 'CO_347', name : 'Castor bean'},
  {id : 'CO_338', name : 'Chickpea'},
  {id : 'CO_326', name : 'Coconut'},
  {id : 'CO_335', name : 'Common Bean'},
  {id : 'CO_358', name : 'Cotton'},
  {id : 'CO_340', name : 'Cowpea'},
  {id : 'CO_365', name : 'Fababean'},
  {id : 'CO_337', name : 'Groundnut'},
  {id : 'CO_339', name : 'Lentil'},
  {id : 'CO_322', name : 'Maize'},
  {id : 'CO_346', name : 'Mungbean'},
  {id : 'CO_350', name : 'Oat'},
  {id : 'CO_327', name : 'Pearl millet'},
  {id : 'CO_341', name : 'Pigeonpea'},
  {id : 'CO_330', name : 'Potato'},
  {id : 'CO_367', name : 'Quinoa Ontology'},
  {id : 'CO_320', name : 'Rice'},
  {id : 'CO_324', name : 'Sorghum'},
  {id : 'CO_336', name : 'Soybean'},
  {id : 'CO_360', name : 'Sugar Kelp trait'},
  {id : 'CO_359', name : 'Sunflower'},
  {id : 'CO_331', name : 'Sweet Potato'},
  {id : 'CO_356', name : 'Vitis'},
  {id : 'CO_321', name : 'Wheat'},
  {id : 'CO_357', name : 'Woody Plant Ontology'},
  {id : 'CO_343', name : 'Yam'},
];

/*----------------------------------------------------------------------------*/

/**
 * @params selectExpander
 */
export default EntryBase.extend({

  ontologyService : service('data/ontology'),

  /*--------------------------------------------------------------------------*/

  tagName: '',

  /*--------------------------------------------------------------------------*/

  /** noAction is used for these parameters of entry-values, which are used in
   * manage-explorer, but not here - this is just for selecting the Ontology ID:
   *  loadBlock, selectBlock, selectedBlock, selectDataset, selectDataset.
   */
  noAction() {
    dLog('noAction');
  },

  /*--------------------------------------------------------------------------*/

  didReceiveAttrs () {
    this._super(...arguments);

    if (this.ontology) {
      /** Extract rootId from .ontology ID; this regexp works for CropOntology IDs. */
      let
      rootIdMatch = this.ontology.match(/^(CO_[0-9]+):/),
      rootId = rootIdMatch && rootIdMatch[1];
      this.set('root', rootId);
    }
  },

  /*--------------------------------------------------------------------------*/

  values : alias('ontologyTree'),

  /**
   * @param value .type === "term", value is a root of an Ontology tree.
   */
  rootOntologyNameId : computed('values', function () {
    let
    valuesP = this.values,
    text = thenOrNow(valuesP, (values) => ('[' + values.id + ']  ' + values.text));

    let ObjectPromiseProxy = ObjectProxy.extend(PromiseProxyMixin);
    let proxy = ObjectPromiseProxy.create({ promise: resolve(text) });

    return proxy;
  }),

  /*--------------------------------------------------------------------------*/

  /**  roots listed in CropOntology.org/ home page  */
  roots : cropOntologyRoots,
  /** Selected from .roots by user via pull-down */
  root : undefined,

  /*--------------------------------------------------------------------------*/

  levelMeta : new WeakMap(),

  ontologyTree : computed('root', function () {
    let
    // rootId = ... this.ontology, @see rootIdMatch
    treeP = this.get('ontologyService').getTree(this.root);
    treeP = thenOrNow(
      treeP,
      (tree) => {
        typeMetaIdChildrenTree(this.levelMeta, tree);
        return tree;
      });

    let ObjectPromiseProxy = ObjectProxy.extend(PromiseProxyMixin);
    let proxy = ObjectPromiseProxy.create({ promise: resolve(treeP) });

    return proxy;
  }),

  /*--------------------------------------------------------------------------*/



});



