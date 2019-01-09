import Ember from "ember";

import { filter, filterBy, mapBy, setDiff, uniqBy } from '@ember/object/computed';


import ManageBase from './manage-base'

/* global d3 */

let initRecursionCount = 0;

let trace_dataTree = 1;

export default ManageBase.extend({

  init() {
    this._super();
    if (initRecursionCount++ > 5) {
      debugger;
    }
    let store = this.get('store');

    let me = this;
    let view = me.get('view');
    let filter = {'include': 'blocks'};
    if (view == 'matrixview') {
      filter['where'] = {'type': 'observational'};
    }
    store.query('dataset', {filter: filter}).then(function(datasets) {
      me.set('datasets', datasets.toArray());
    })
  },
  datasetType: null,

  filterOptions: {
    'all': {'formal': 'All', 'icon': 'plus'},
    'private': {'formal': 'Private', 'icon': 'lock'},
    'owner': {'formal': 'Mine', 'icon': 'user'}
  },
  filter: 'all',
  layout: {
  },
  /** Filter / Group patterns.  initially 0 elements. */
  filterGroups : Ember.A(), // [{}]
  filterGroupsChangeCounter : 0,
  datasets: [],
  data: Ember.computed('datasets', 'filter', function() {
    let availableMaps = this.get('datasets')
    let filter = this.get('filter')
    // perform filtering according to selectedChr
    // let filtered = availableMaps //all
    if (filter == 'private') {
      let maps = availableMaps.filterBy('public', false)
      return maps
    } else if (filter == 'owner') {
      return availableMaps.filterBy('owner', true)
    } else {
      return availableMaps;
    }
  }),
  dataEmpty: Ember.computed('data', function() {
    let availableMaps = this.get('data')
    if (availableMaps && availableMaps.length > 0) { return false; }
    else { return true; }
  }),
  /* ------------------------------------------------------------------------ */
  /** group the data in : Dataset / Block
   * Used for datasets without a parent
   */

  /** datasets with a .parent, i.e. containing child data blocks */
  withParent: filter('data', function(dataset, index, array) {
    return dataset.get('parent.content');
  }),
  /** Names of all datasets - just for trace / devel, not used. */
  names : mapBy('data', 'name'),

  // parents are reference assemblies
  /** result of uniqBy is a single dataset which refers to each (parent)
   * dataset; just 1 child of each parent is in the result. */
  child1 : uniqBy('withParent', 'parent.name'),
  /** parents of child1(), i.e. all the parent datasets, just once each.  */
  parents : mapBy('child1', 'parent'),
  /** names of parents(). */
  parentNames : mapBy('parents', 'name'),
  /** Datasets without a .parent; maybe a reference assembly (genome) or a GM. */
  withoutParent: filter('data', function(dataset, index, array) {
    return ! dataset.get('parent.content');
  }),
  // these 3 CFs are non-essential, used in trace.
  withoutParentNames : mapBy('withoutParent', 'name'),
  parentsid : mapBy('parentsNonUnique', 'id'),
  // an alternate method to calculate parents: parentsUnique
  parentsNonUnique : mapBy('withParent', 'parent'),
  parentsUnique : uniqBy('parentsNonUnique', 'name'),
  /** for trace - checking parentsUnique(). */
  parentsUniqueNames : mapBy('parentsUnique', 'name'),

  // dataWithoutParent are genetic maps
  /** setDiff works on names, but not on computed properties, hence the need for parentsContent.
   * This works; only used as checking trace / devel.
   */
  dataWithoutParentNames : setDiff('withoutParentNames', 'parentNames'),
  parentsContent : mapBy('parents', 'content'),
  dataWithoutParent : setDiff('withoutParent', 'parentsContent'),
  /** Same result as dataWithoutParentNames; just for trace / checking. */
  dataWithoutParent0Names : mapBy('dataWithoutParent', 'name'),

  /** used by dataWithoutParent1 (i.e. the non-setDiff version) */
  parentsSet : Ember.computed('parentNames', function () {
    let parents = this.get('parentNames'),
    set = parents.reduce(function(result, value) { return result.add(value); }, new Set());
    return set;
  }),
  /** Alternative to dataWithoutParent based on setDiff.
   * The setDiff version is working OK, after introducing parentsContent,
   * so this equivalent is not required.
   */
  dataWithoutParent1: filter('withoutParent', function(dataset, index, array) {
    let parentsSet = this.get('parentsSet'),
    name = dataset.get('name'),
    found = parentsSet.has(name);
    if (index === 0)
    {
      console.log('dataWithoutParent', array, parentsSet, dataset);
    }
    console.log(dataset._internalModel.__data, index, name, found);
    return ! found;
  }).property('withoutParent.[]', 'parentsSet', 'parents'),

  /* ------------------------------------------------------------------------ */

  levelMeta : new WeakMap(),

  /** group the data in : Parent / Scope / Block
   */
  dataTree : Ember.computed('data', 'dataTreeFG', 'filterGroups.[]',    function() {
    let
    filterGroups = this.get('filterGroups'),
    datasets = (filterGroups.length) ? this.get('dataTreeFG') : this.parentAndScope(this.get('data'));
    return datasets;
  }),
  dataTreeFG : Ember.computed(
    'data', 'filterGroups.0.component.@each', 'filterGroupsChangeCounter',
    function() {
    let datasets = this.get('data'),
    filterGroup = this.get('filterGroups.0.component'),
    metaFieldName = 'Created',
    /** used in development */
    metaFilterDev = function(f) {
      let meta = f.get('meta');
      if (trace_dataTree > 1)
        console.log('metaFilter', f.get('name'), meta);
      let v = f.get('meta' + '.' + metaFieldName);
      if (v) {
        (v = v.split(', ')) && (v = v[0]);
      }
      else if (meta) {
        /** current test data doesn't have much meta, so match what is available.  */
        v = v || meta.variety || 
          meta.shortName || 
          meta.paths || 
          meta.year || 
          meta.source;
      }
      return v;
    },
    isFilter = filterGroup && (filterGroup.filterOrGroup === 'filter'),  //  else group
    /** apply filter/group fg to f
     * @return true/false if fg is a filter, otherwise the value to group on
     */
    metaFilterFG = function(f, fg) {
      let meta = f.get('meta');
      if (trace_dataTree > 1)
        console.log('metaFilter', f.get('name'), meta);
      /** key : value pair which matches fg.pattern  */
      let key, value;
      let
        regexp = fg.isRegExp ? new RegExp(fg.pattern) : undefined,
      /** apply fg.pattern to string a.
       * fg.isRegExp indicates if pattern is a regular expression or a string
       * @return true if match
       */
      match = function (a) {
        let match = fg.isRegExp ? regexp(a) : a.includes(fg.pattern);
        return match;
      },
      valueToString = function(v) {
        let s =
          (typeof v === 'string') ? v :
          (typeof v === 'object') ? JSON.stringify(v) :
          '' + v;
        return s;
      };

      for (let key1 in meta) {
        if (meta.hasOwnProperty(key1)) {
          /** The value used for grouping should be a string.  */
          let value1 = valueToString(meta[key1]),
          matched = (fg.matchKey && match(key1)) ||
            (fg.matchValue && match(value1));
          if ((trace_dataTree > 1) && matched) {
            console.log(key1 + ' : ' + value1);
          }
          if (fg.isNegated && ! isFilter)
            matched = ! matched;
          if (matched) {
            key = key1;
            if (isFilter)
              value = true;
            else
            /*  value may be large/complex - maybe truncate long JSON. */
            value = value1;
            break;
          }
        }
      };
      if (fg.isNegated && isFilter)
        value = ! value;

      return value;
    },
    metaFilter = (filterGroup && filterGroup.pattern) ?
      function (d) { return metaFilterFG(d, filterGroup); }
    : metaFilterDev,
    /** n is an array : [{key, values}, ..] */
    n = d3.nest()
      .key(metaFilter)
      .entries(datasets),
    me = this,
    /** parentAndScope() could be restructured as a key function, and used in d3-array.group(). */
    /** reduce nest to a Map, processing values with parentAndScope() */
    map2 = n.reduce(function (map, nestEntry) {
      let key = nestEntry.key,
      value = nestEntry.values;
      map.set(key, me.parentAndScope(value));
      return map; },
      new Map()
    );
    /** {{each}} of Map is yielding index instead of key, so convert Map to a hash */
    let hash = {};
    for (var [key, value] of map2) {
      if (trace_dataTree > 1)
        console.log(key + ' : ' + value);
      hash[key] = value;
    }
    if (trace_dataTree)
      console.log('map2', map2, hash);
    return hash;
  }),
  parentAndScope(datasets) {
    let
    levelMeta = this.get('levelMeta'),
    withParent = datasets.filter(function(f) {
      let p = f.get('parent');
      return p.get('content'); }),
    /** can update this .nest() to d3.group() */
    n = d3.nest()
      .key(function(f) { let p = f.get('parent'); return p ? p.get('name') : '_'; })
      .entries(withParent);
    /** this reduce is mapping an array  [{key, values}, ..] to a hash {key : value, .. } */
    let grouped =
      n.reduce(
        function (result, datasetsByParent) {
          let scopes = 
          result[datasetsByParent.key] =
	          datasetsByParent.values.reduce(function (blocksByScope, dataset) {
              console.log('blocksByScope', blocksByScope, dataset);
              let blocks = dataset.get('blocks').toArray();
              blocks.forEach(
                function (b) {
                  let scope = b.get('scope'),
                  blocksOfScope = blocksByScope[scope] || (blocksByScope[scope] = []);
                  blocksOfScope.push(b);
                });
              return blocksByScope;
            }, {});
          levelMeta.set(scopes, "Scope");
          return result;
        },
        {});
    console.log('dataTree', grouped);
    this.levelMeta.set(grouped, "Parent");
    return grouped;
  },

  actions: {
    refreshAvailable() {
      let me = this;
      let view = me.get('view');
      let filter = {'include': 'blocks'};
      if (view == 'matrixview') {
        filter['where'] = {'type': 'observational'};
      }
      this.get('store').query('dataset', {filter: filter}).then(function(datasets) {
        me.set('datasets', datasets.toArray());
      });
    },
    deleteBlock(chr) {
      this.sendAction('deleteBlock', chr.id);
    },
    changeFilter: function(f) {
      this.set('filter', f)
    },
    filterGroupsChanged : function(fg) {
      console.log('filterGroupsChanged', fg);
      this.incrementProperty('filterGroupsChangeCounter');
    },
    onDelete(id) {
      
    },
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    }
  }
});
