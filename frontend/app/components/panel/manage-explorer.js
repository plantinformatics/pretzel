import Ember from "ember";
import DS from 'ember-data';

import { filter, filterBy, mapBy, setDiff, uniqBy } from '@ember/object/computed';


import ManageBase from './manage-base'

/* global d3 */

let initRecursionCount = 0;

let trace_dataTree = 2;

export default ManageBase.extend({

  init() {
    this._super();
    if (initRecursionCount++ > 5) {
      debugger;
    }
  },
  datasetsRefreshCounter : 0,
  datasets : Ember.computed('view', 'datasetsRefreshCounter', function () {
    let store = this.get('store');

    let me = this;
    let view = me.get('view');
    let filter = {'include': 'blocks'};
    if (view == 'matrixview') {
      filter['where'] = {'type': 'observational'};
    }
    let promise =
    store.query('dataset', {filter: filter});
    promise.then(function(datasets) {
      console.log('datasets', datasets.toArray());
    });

    return DS.PromiseArray.create({ promise: promise });
//      new Ember.RSVP.Promise((resolve) => { promise.then(function(datasets) { resolve(datasets); } ); } );
  }),
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
  dataPre: Ember.computed('datasets', 'datasets.[]', 'filter', function() {
    let availableMaps = this.get('datasets')
    let filter = this.get('filter')
    console.log('dataPre', availableMaps, filter);
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
  /** @return result is downstream of filter and filterGroups */
  data : Ember.computed('dataPre', 'dataFG',    function() {
    let
    filterGroups = this.get('filterGroups'),
    datasets = (filterGroups.length) ? this.get('dataFG') : this.get('dataPre');
// this.parentAndScope()
    return datasets;
  }),
  dataEmpty: Ember.computed('datasets', 'datasets.length', 'datasets.[]', function() {
    let length = this.get('datasets.length'),
    nonEmpty = (length > 0);
    return ! nonEmpty;
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
  /** Alternative to dataWithoutParent, which is based on setDiff.
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
      filterGroupsLength = this.get('filterGroups.length'),
    me = this,
    dataP,
    datasets = filterGroupsLength ?
      DS.PromiseObject.create({promise : this.get('dataTreeFG') })
      : (dataP = this.get('data'))
      &&
      DS.PromiseObject.create({
        promise:
        dataP.then(function (data) { data = data.toArray(); console.log('dataTree data', data);  return me.parentAndScope(data);
                                   })
      });
    return datasets;
  }),
  /** @return promise of a hash */
  dataTreeFG : Ember.computed(
    'dataFG',
    function() {
      let datasetGroupsP = this.get('dataFG'),
      me = this,
      promise = datasetGroupsP.then(function(datasetGroups) {
        console.log('datasetGroups', datasetGroups);
        let
          result = {};
        for (var key in datasetGroups) {
          if (datasetGroups.hasOwnProperty(key)) {
            result[key] = me.parentAndScope(datasetGroups[key]);
          }
        }
        return result;
      });
      return promise;
    }),
  /** Split the datasets according to their dataset.meta.type,
   * or otherwise by whether the dataset has a parent or children.
   */
  dataTyped : Ember.computed(
    'dataPre',
    function() {
      let datasetsP = this.get('dataPre');
      let me = this,
      promise = datasetsP.then(function (datasets) {
        datasets = datasets.toArray();
        let dataTyped = {};
        let parents = me.get('parents')
          .map(function (p) { return p.content || p; });
        console.log('parents', me.get('parents'), parents);
        for (let i=0; i < datasets.length; i++) {
          let d = datasets[i],
          typeName = d.get('meta.type');
          if (! typeName) {
            let parent = d.get('parent');
            if (parent.hasOwnProperty('content'))
              parent = parent.content;
            if (parent)
              typeName = 'annotation';
            else
            {
              let hasChildren = parents.indexOf(d) >= 0;  // i.e. !== -1
              typeName = hasChildren ? "reference" : "genetic-map";
              console.log(hasChildren, typeName);
            }
          }
          if (! dataTyped[typeName])
            dataTyped[typeName] = [];
          dataTyped[typeName].push(d);
        }
        console.log('dataTyped', dataTyped);

        dataTyped['annotation'] = me.parentAndScope(dataTyped['annotation']);
        let levelMeta = me.levelMeta;
        levelMeta.set(dataTyped['annotation'], "Parent");
        levelMeta.set(dataTyped['reference'], "Datasets");
        levelMeta.set(dataTyped['genetic-map'], "Datasets");

        return dataTyped;
      }),
      promiseP = DS.PromiseObject.create({ promise: promise });
      return  promiseP;
    }),
  /**
   * dataPre -> dataTyped ->
   * dataFG CF -> hash by value, of datasets
   * -> dataTreeFG -> plus mapToParentScope
   */
  dataFG : Ember.computed(
    'dataTyped', 'filterGroups.[]', 
    'filterGroups.0.component.@each', 'filterGroupsChangeCounter',
    function() {
      let
        dataTypedP = this.get('dataTyped'),
      filterGroup = this.get('filterGroups.0.component'),
      me = this;
      return dataTypedP.then(function (dataTyped) {
        let typedFG = {};
        Object.entries(dataTyped).forEach(
          ([typeName, datasets]) => 
            {
              console.log(typeName, datasets);
              // this is now done in dataTyped(), so not needed here
              if (datasets.toArray) {
                console.log('dataFG toArray?');
                debugger;
                datasets = datasets.toArray();
              }
              datasets = me.datasetFilter(datasets, filterGroup);
              typedFG[typeName] = datasets;
            }
        );
      });
    }),
  /** Apply filterGroup to datasets, and return the result. */
    datasetFilter(datasets, filterGroup) {
      let
      unused1 = filterGroup && console.log('dataFG filterGroup', filterGroup, filterGroup.filterOrGroup, filterGroup.pattern),
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
      let keyFields = [];
      if (fg.fieldName)
        keyFields.push('name');
      if (fg.fieldScope)
        keyFields.push('scope');
      if (fg.fieldMeta)
        keyFields.push('meta');

      if (trace_dataTree > 1)
        console.log('metaFilter', f.get('name'));
      /** key : value pair which matches fg.pattern  */
      let key, value;
      let
        regexp = fg.isRegExp ? new RegExp(fg.pattern) : undefined,
      /** apply fg.pattern to string a.
       * fg.isRegExp indicates if pattern is a regular expression or a string
       * @return true if match
       */
      match = function (a) {
        let match = fg.isRegExp ? regexp.exec(a) : a.includes(fg.pattern);
        return match;
      },
      valueToString = function(v) {
        let s =
          (typeof v === 'string') ? v :
          (typeof v === 'object') ? JSON.stringify(v) :
          '' + v;
        return s;
      };

      for (let i = 0; ! value && (i < keyFields.length); i++) {
        let fieldName = keyFields[i];
        let meta = f.get(fieldName);
        if (trace_dataTree > 2)
          console.log(fieldName, '\t: ', meta);
        if (typeof meta !== 'object')
        {
          /* it will be useful to be able to group by .name or .scope value;
           * use specificKey=true to signify this,
           * e.g. if pattern === fieldName, group by f.get[fieldName].
           * otherwise (normal case), don't match key, match by value.
           */
          value = matchField(f, fieldName, true);
        }
        else
        {
          for (let key1 in meta) {
            value = matchField(meta, key1, false);
            if (value)
              break;
          }
        }
        /** match against the key and/or value of meta[key1]
         * @param specificKey true for .name and .scope,  to indicate key implicitly matches.
         */
        function matchField(meta, key1, specificKey) {
          /** @param obj may be an Ember Object, or the value of e.g. its .meta field. */
          function getValue(obj, key) {
            return (typeof meta.get === 'function') ?
              meta.get(key)
              : (meta.hasOwnProperty(key1) && meta[key]);
          }
          let value,
          rawValue = getValue(meta, key1);
          if (rawValue) {
          /** The value used for grouping should be a string.
           * The schema indicates that the values of .name and .scope are strings.
           * So we could apply valueToString() only when ! meta.get,
           * but structured fields in addition to .meta could be added to keyFields[].
           */
            let value1 = valueToString(rawValue),
            matched =
              (specificKey ? (fg.pattern == key1)
               : (fg.matchKey && match(key1))) ||
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
          }
        }
          return value;
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
      .entries(datasets || []),
    /** parentAndScope() could be restructured as a key function, and used in d3-array.group(). */
    /** reduce nest to a Map, processing values with parentAndScope() */
    map2 = n.reduce(function (map, nestEntry) {
      let key = nestEntry.key,
      value = nestEntry.values;
      map.set(key, value);
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
    },
  /** Given an array of datasets, group them by parent, then within each parent,
   * group by scope the blocks of the datasets of the parent.
   */
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
          /** hash: [scope] -> [blocks]. */
          let scopes = 
            /** key is parent name */
          result[datasetsByParent.key] =
            datasetsByParent.values.reduce(function (blocksByScope, dataset) {
              if (trace_dataTree > 2)
                console.log('blocksByScope', blocksByScope, dataset);
              /** Within a parent, for each dataset of that parent,
               * reference all the blocks of dataset, by their scope.  */
              let blocks = dataset.get('blocks').toArray();
              blocks.forEach(
                function (b) {
                  let scope = b.get('scope'),
                  blocksOfScope = blocksByScope[scope] || (blocksByScope[scope] = []);
                  blocksOfScope.push(b);
                  levelMeta.set(b, "Blocks");
                });
              return blocksByScope;
            }, {});
          levelMeta.set(scopes, "Scope");
          return result;
        },
        {});
    if (trace_dataTree)
      console.log('parentAndScope', grouped);
    this.levelMeta.set(grouped, "Parent");
    return grouped;
  },

  actions: {
    refreshAvailable() {
      this.incrementProperty('datasetsRefreshCounter');
    },
    deleteBlock(chr) {
      this.sendAction('deleteBlock', chr.id);
    },
    changeFilter: function(f) {
      this.set('filter', f)
    },
    filterGroupsChanged : function(fg) {
      if (trace_dataTree)
        console.log('filterGroupsChanged', fg, this.get('filterGroups.0.component'), this.get('filterGroups.0'));
      this.incrementProperty('filterGroupsChangeCounter');
    },
    onDelete(id) {
      
    },
    loadBlock(block) {
      this.sendAction('loadBlock', block);
    }
  }
});
