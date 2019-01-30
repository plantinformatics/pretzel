import Ember from "ember";
import DS from 'ember-data';

import { computed } from '@ember/object';
import { filter, filterBy, mapBy, setDiff, uniqBy, uniq, union } from '@ember/object/computed';

import {tab_explorer_prefix, text2EltId } from '../../utils/explorer-tabId';


import ManageBase from './manage-base'

/* global d3 */

let initRecursionCount = 0;

let trace_dataTree = 3;

/** If true, use datatypeFromFamily() to intuit a dataset type for datasets
 * which do not define meta.type.
 * datatypeFromFamily() uses the dataset parent and children : datasets with
 * neither are considered 'genetic-map', datasets with parents are 'annotation',
 * and datasets with neither are 'reference'.
  */
const enable_datatypeFromFamily = false;

const selectorExplorer = 'div#left-panel-explorer';

export default ManageBase.extend({

  init() {
    this._super();
    if (initRecursionCount++ > 5) {
      debugger;
    }
  },

  enable_datatypeFromFamily : enable_datatypeFromFamily,

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
  }),
  datasetType: null,

  /** keys are 'all', and the found values of dataset.meta.type;
   * value is true if filterGroup is a filter, and datasetFilter matched at the datasets level.
   *
   * filterGroup may apply at both the dataset level and the blocks level, but
   * it makes sense to apply it at only 1 level : if there are matches at the
   * higher level (dataset) then don't apply it at a lower level (block).
   * If there are no matches at the higher level then treat the filter as not
   * having applied, and apply it instead at the lower level.
   *  i.e.
   * . if grouping, then it applies to dataset level only
   * . if filter, if any matches in a tab at dataset level, then don't apply filter at blocks level for that tab.
   *   if no matches at the dataset level then treat all values as having matched.
   *
   * filterMatched is used to implement this logic.
   */
  filterMatched : {},

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
  /** @return the filterGroup if there is one, and it has a pattern. */
  useFilterGroup : Ember.computed(
    'filterGroups', 'filterGroups.[]',
    'filterGroups.0.component.@each', 'filterGroupsChangeCounter',
    function () {
    let
      filterGroupsLength = this.get('filterGroups.length'),
    filterGroup;
    if (filterGroupsLength) {
      filterGroup = this.get('filterGroups.0.component');
      if (filterGroup) {
        if (! filterGroup.get('defined'))
          filterGroup = undefined;
      }
    }
    return filterGroup;
  }),
  /** @return true if a filterGroup is defined and it is a filter not a grouping. */
  isFilter : Ember.computed('useFilterGroup', function () {
    let filterGroup = this.get('useFilterGroup'),
    isFilter = filterGroup && (filterGroup.filterOrGroup === 'filter');
    return isFilter;
  }),
  /** @return result is downstream of filter and filterGroups */
  data : Ember.computed('dataPre', 'dataFG', 'isFilter',    function() {
    let
      /** The result of a filter is an array of datasets, whereas a grouping results in a hash.
       * The result of data() should be an array, so only use filterGroup if it is a filter.
       */
    isFilter = this.get('isFilter'),
    datasets = isFilter ? this.get('dataFG') : this.get('dataPre');
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
  /** meta.types of parents(). */
  parentsTypes : computed('parents', function () {
    return this.get('parents').filterBy('meta.type').uniqBy('meta.type').mapBy('meta.type');
  }),
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

/** group all datasets by parent type
 * add tabs for those, FG can apply, so: 
 * -> dataParentTypedFG -> dataParentTypedFGTree
  */
  dataParentTyped : Ember.computed
  (
    // based on dataTyped()
    'dataPre',
    function() {
      let datasetsP = this.get('dataPre');
      let me = this,
      promise = datasetsP.then(function (datasets) {
        datasets = datasets.toArray();
        let dataTyped = {};
        for (let i=0; i < datasets.length; i++) {
          let d = datasets[i],
          typeName = d.get('parent.meta.type');
          if (! typeName)
          {
            if (trace_dataTree > 3)
            console.log('dataset without parent.meta.type', d.get('name'), d.get('parent.name'));
          }
          else
          {
            if (! dataTyped[typeName]) {
              dataTyped[typeName] = [];
              me.levelMeta.set(dataTyped[typeName], 'Datasets');
            }
            dataTyped[typeName].push(d);
          }
        }
        console.log('dataParentTyped', dataTyped);
        return dataTyped;
      }),
      promiseP = DS.PromiseObject.create({ promise: promise });
      return  promiseP;
    }),



  /** group the data in : Parent / Scope / Block
   */
  dataTree : Ember.computed('data', 'dataTypedTreeFG', 'useFilterGroup',    function() {
    let
      filterGroup = this.get('useFilterGroup'),
    me = this,
    datasets;
    if (filterGroup) {
      /** dataTypedTreeFG is already a PromiseObject, but need to extract the
       * value .annotation */
      let promise = this.get('dataTypedTreeFG')
        .then( function (d) { return d.annotation; } );
      datasets =
        DS.PromiseObject.create({promise : promise });
    } else {
      let dataP = this.get('data');
      if (dataP ) {
        datasets =
          DS.PromiseObject.create({
            promise:
            dataP.then(function (data) {
              data = data.toArray();
              console.log('dataTree data', data);
              return me.parentAndScope(data, 'all');
            })
          });
      }
    }
    return datasets;
  }),
  /** @return promise of a hash */
  dataTypedTreeFG : Ember.computed(
    'dataTypedFG', 'parentsTypes',
    function() {
      return this.addParentAndScopeLevelsPromise('dataTypedFG');
    }),
  /** @return promise of a hash */
  dataParentTypedFGTree : Ember.computed(
    'dataParentTypedFG', 'parentsTypes',
    function() {
      return this.addParentAndScopeLevelsPromise('dataParentTypedFG');
    }),
  addParentAndScopeLevelsPromise : function (valueName) {
      let datasetGroupsP = this.get(valueName),
      me = this,
      parentsTypes = me.get('parentsTypes'),
      promise = datasetGroupsP.then(addParentAndScopeLevels);
      console.log('parentsTypes', parentsTypes);
      /** Given datasets grouped into tabs, add a grouping level for the parent of the datasets,
       * and a level for the scope of the blocks of the datasets.
       * (for those tabs for which it is enabled - e.g. annotation)
       * @param datasetGroups is grouped by dataset.meta.type tabs
       */
      function addParentAndScopeLevels(datasetGroups) {
        console.log('datasetGroups', datasetGroups);
        let
          result = {};
        for (var key in datasetGroups) {
          if (datasetGroups.hasOwnProperty(key)) {
            let value = datasetGroups[key],

            /** parents.indexOf(d) (in dataTyped()) also checks if a given value
             * is a parent, but in that case d is the Dataset object, whereas key
             * is the meta.type (if a parent does not have meta.type it does not have a tab named by type).
             */
            isParent = parentsTypes.indexOf(key) >= 0;  // i.e. !== -1
            console.log('addParentAndScopeLevels', key, value, isParent);

            if (isParent || (key === 'annotation')) {
              value = me.parentAndScope(value, key);
              me.levelMeta.set(value, 'Parent');
            }
            result[key] = value;
          }
        }
        console.log('dataTypedTreeFG', result);
        return result;
      }
      let promiseObject =
        DS.PromiseObject.create({promise : promise });
      return promiseObject;
    },
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
          /** If the dataset's meta.type is the same as its parent's then only
           * show it under the parent.
           */
          let parentType = d.get('parent.meta.type');
          if (parentType === typeName)
            typeName = undefined;

          if (! typeName && enable_datatypeFromFamily) {
            typeName = datatypeFromFamily(d);
            function datatypeFromFamily() {
              let typeName;
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
              return typeName;
            }
          }
          if (! typeName)
          {
            if (trace_dataTree > 3)
              console.log('dataset without typeName', d.get('name'), d.get('meta'));
          }
          else
          {
            if (! dataTyped[typeName])
              dataTyped[typeName] = [];
            dataTyped[typeName].push(d);
          }
        }
        console.log('dataTyped', dataTyped);

        // dataTyped['annotation'] = me.parentAndScope(dataTyped['annotation']);
        let levelMeta = me.levelMeta;
        function setType(typeName, template) {
          let d = dataTyped[typeName];
          if (d) {
            try { levelMeta.set(d, template); }
            catch (e) { console.log(typeName, template, d, e); debugger; }
          }
        }
        setType('annotation', 'Datasets');  // 'Parent'
        setType('reference', 'Datasets');
        setType('genetic-map', 'Datasets');

        return dataTyped;
      }),
      promiseP = DS.PromiseObject.create({ promise: promise });
      return  promiseP;
    }),
  /**
   * dataPre -> dataTyped ->
   * dataTypedFG CF -> hash by value, of datasets
   * -> dataTypedTreeFG -> plus mapToParentScope
   */
  dataTypedFG : Ember.computed(
    'dataTyped', 'useFilterGroup',
    function() {
      return this.applyFGs('dataTyped');
    }),
  dataParentTypedFG : Ember.computed(
    'dataParentTyped', 'useFilterGroup',
    function() {
      return this.applyFGs('dataParentTyped');
    }),
  /** Apply the filterGroups, if any.
   * Currently just 1 filterGroup is supported;
   * the design is mostly in place to support multiple.
   */
  applyFGs : function(valueName) {
      let
        dataTypedP = this.get(valueName),
    filterGroup = this.get('useFilterGroup'),
    me = this;
      if (filterGroup) {
        dataTypedP = dataTypedP.then(applyFGs);
        function applyFGs (dataTyped) {
          let typedFG = {};
          Object.entries(dataTyped).forEach(
            ([typeName, datasets]) => 
              {
                console.log(typeName, datasets);
                // toArray() is now done in dataTyped(), so not needed here
                if (dataTyped.content && datasets.toArray) {
                  console.log('applyFGs toArray?');
                  debugger;
                  datasets = datasets.toArray();
                }
                datasets = me.datasetFilter(datasets, filterGroup, typeName);
                typedFG[typeName] = datasets;
              }
          );
          return typedFG;
        }
      }
      return dataTypedP;
    },
  /**
   * dataFG CF -> hash by value, of datasets
   */
  dataFG : Ember.computed(
    'dataPre', 'useFilterGroup',
    function() {
      let datasetsP = this.get('dataPre'),
      filterGroup = this.get('useFilterGroup'),
      me = this;
      return datasetsP.then(function (datasets) {
        datasets = datasets.toArray();
        return me.datasetFilter(datasets, filterGroup, 'all');
      });
    }),

  /** Apply filterGroup to datasets, and return the result.
   * @param tabName the value of dataset.meta.type which datasets share, or 'all'.
   */
  datasetFilter(datasets, filterGroup, tabName) {
    /** argument checking : expect that filterGroup exists and defines a filter / grouping */
    if (! filterGroup || ! filterGroup.get('defined')) {
      console.log('datasetFilter incomplete filterGroup :', filterGroup);
      return [];
    }

      let
      unused1 = filterGroup && console.log('dataFG filterGroup', filterGroup, filterGroup.filterOrGroup, filterGroup.pattern),
      /** datasets is an array of either datasets or blocks.  fieldScope and fieldNamespace are only applicable to blocks  */
      isDataset = datasets && datasets[0] && datasets[0].constructor.modelName === 'dataset',
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
      if (fg.fieldScope && ! isDataset)
        keyFields.push('scope');
      if (fg.fieldNamespace && ! isDataset)
        keyFields.push('namespace');
      if (fg.fieldMeta)
        keyFields.push('meta');

      if (trace_dataTree > 1)
        console.log('metaFilter', f.get('name'));
      /** key : value pair which matches fg.pattern  */
      let key, value;
      let
      /** @return true if string a matches any of the patterns defined by fg.
       */
      match = function (a) {
        return fg.match(a);
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
              (specificKey ? ((fg.pattern == key1) || (fg.get('patterns').indexOf(key1) >= 0))
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
    metaFilter = filterGroup.pattern !== metaFilterDev ?
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
      /** if isFilter, result is an array, otherwise a hash */
      let hash = {};
      /* if isFilter, the matched values are within map2.get(true); this is the whole result. */
      if (isFilter) {
        // in n and map2  the keys are already strings, i.e. 'true' and 'undefined'
        let matched = map2.get('true');
        let filterMatched = this.get('filterMatched');
        if (isDataset)
          filterMatched[tabName] = ! ! matched;
        /** map the unmatched key : 'undefined' -> 'unmatched' */
        let unmatched = map2.get('undefined');
        /* for isFilter, result is an array, except if !matched && unmatched && !ignoreFilter,
         * in which case unmatched is (currently) added, with key 'unmatched'.
         * The 'unmatched' is mostly a devel feature, for checking the result,
         * and may be flagged out.
         */
        if (matched) {
          hash = matched;
          if (unmatched)
            hash.push({'unmatched' : unmatched});
        }
        else if (unmatched)
        {
          /** @see filterMatched  */
          let ignoreFilter = isDataset;
          if (ignoreFilter)
            hash = unmatched;
          else
            hash['unmatched'] = unmatched;
        }
      }
      else {
    /** {{each}} of Map is yielding index instead of key, so convert Map to a hash */
    for (var [key, value] of map2) {
      if (trace_dataTree > 1)
        console.log(key + ' : ' + value);
      if (key === 'undefined')
        key = 'unmatched';
      hash[key] = value;
    }
      }
    if (trace_dataTree)
      console.log(tabName, n, isFilter, 'map2', map2, hash);
    return hash;
    },
  /** Given an array of datasets, group them by parent, then within each parent,
   * group by scope the blocks of the datasets of the parent.
   * @param tabName the value of dataset.meta.type which datasets share, or 'all'.
   * @param withParentOnly  false means also show datasets without parents
   * They are (currently) grouped in 'undefined'
   */
  parentAndScope(datasets, tabName, withParentOnly) {
    let
      me = this,
    levelMeta = this.get('levelMeta'),
    /** datasets may be : {unmatched: Array()} */
    withParent = datasets.filter ? datasets.filter(function(f) {
      /** f may be {unmatched: Array}, which can be skipped. */
      let p = f.get && f.get('parent.content');
      return p; }) : [],
    /** can update this .nest() to d3.group() */
    n = d3.nest()
    /* the key function will return undefined for datasets without parents, which will result in a key of 'undefined'. */
      .key(function(f) { let p = f.get('parent'); return p && p.get('name'); })
      .entries(withParentOnly ? withParent : datasets);
    /** this reduce is mapping an array  [{key, values}, ..] to a hash {key : value, .. } */
    let grouped =
      n.reduce(
        function (result, datasetsByParent) {
          let key = datasetsByParent.key,
          values = datasetsByParent.values;
          /** hash: [scope] -> [blocks]. */
          if (trace_dataTree > 1)
            console.log('datasetsByParent', datasetsByParent);
          // as commented in .key() function above.
          if  (key === 'undefined') {
            /* datasets without parent - no change atm, just convert the nest to hash.
             * but possibly move the children up to be parallel to the parents.
             * i.e. merge datasetsByParent.values into result.
             */
            // can change this to return value, and move result2[name] = value; outside .reduce()
            // grouped =   // keys are added to grouped,  object refn is unchanged.
            values.reduce(function (result2, dataset) {
              let
                name = dataset.get('name'),
              /** children may be a DS.PromiseManyArray. It should be fulfilled by now. */
              children = dataset.get('children');
              if (children.content)
                children = children.content;
              if (children.length) {
                let 
                  value = me.datasetsToBlocksByScope(tabName, levelMeta, children);
                me.levelMeta.set(value, 'Parent');
                result2[name] = value;
              }
              else {
                if (dataset.then)
                  dataset = DS.PromiseObject.create({ promise: dataset });
                console.log(name, levelMeta, 'levelMeta.set(', dataset, 'Dataset');
                levelMeta.set(dataset, 'Dataset');
                result2[name] = dataset;
              }
              return result2;
            },
              result);
          }
          else
          {
            /** key is parent name */
          result[key] =
            me.datasetsToBlocksByScope(tabName, levelMeta, datasetsByParent.values);
          };
          return result;
        },
        {});
    if (trace_dataTree)
      console.log('parentAndScope', tabName, grouped);
    this.levelMeta.set(grouped, "Parent");
    return grouped;
  },
  /** Given an array of datasets, group their blocks by the scope of the blocks. */
  datasetsToBlocksByScope(tabName, levelMeta, datasets) {
    let me = this;
          let scopes = 
            datasets.reduce(function (blocksByScope, dataset) {
              if (trace_dataTree > 2)
                console.log('blocksByScope', blocksByScope, dataset);
              /** Within a parent, for each dataset of that parent,
               * reference all the blocks of dataset, by their scope.  */
              let blocks = dataset.get('blocks').toArray();
              let filterMatched = me.get('filterMatched');
              let isFiltered = filterMatched[tabName];
              let filterGroup = me.get('useFilterGroup');
              if (! isFiltered && filterGroup) {
                let
                  isBlockFilter = filterGroup && (filterGroup.filterOrGroup === 'filter') &&
                  (filterGroup.fieldScope || filterGroup.fieldNamespace);
                if (isBlockFilter) {
                  let matched = me.datasetFilter(blocks, filterGroup, tabName),
                  b = matched;
                  if (b && b.length)
                    blocks = b;
                  else {
                    console.log('isBlockFilter', blocks, filterGroup, matched);
                    blocks = [];
                  }
                }
              }
              blocks.forEach(
                function (b) {
                  // b may be : {unmatched: Array()} - skip it
                  if (b && b.get) {
                  let scope = b.get('scope'),
                  blocksOfScope = blocksByScope[scope] || (blocksByScope[scope] = []);
                  blocksOfScope.push(b);
                  levelMeta.set(b, "Blocks");
                  }
                });
              return blocksByScope;
            }, {});
          levelMeta.set(scopes, "Scope");
    return scopes;
  },

  actions: {
    /** invoked from hbs via {{compute (action "datasetTypeTabId" datasetType ) }}
     * @return string suitable for naming a html tab, based on datasetType name.
     */
    datasetTypeTabId(datasetType) {
      let
      id = tab_explorer_prefix + text2EltId(datasetType);
      console.log('datasetTypeTabId', id, datasetType);
      return id;
    },
    keysLength(object) {
      return Object.keys(object).length;
    },

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
  },

  /** If a tab is active (selected), save its id.  */
  willRender () {
    let
      explorerDiv = Ember.$(selectorExplorer),
    /** active tab element.  Its child <a> href is '#'+id, but it is easier to
     * extract id from the content div id. */
    t = explorerDiv.find(' li.active-detail.active'),
    /** active content element */
    c = explorerDiv.find(' div.tab-content > .active '),
    id = c[0] && c[0].id;
    if (id) {
      this.set('activeId', id);
      console.log('willRender', id, t[0], c[0]);
    }
  },
  /** For those tabs generated from data, after re-render the active class is lost.
   * So re-add class .active to the tab header and content elements.
   * this.activeId is recorded in willRender().
   */
  didRender () {
    let
      id = this.get('activeId');
    if (id) {
      let
        /** didRender() is called several times during the render, and c.length
         * and t.length will be 0 on some of these initial calls.  In which case
         * the .addClass() does nothing.
         *
         * It is possible that didRender() is called after .addClass() has been
         * done, or when c and a already have their .active class; in this case
         * also .addClass() has no effect, and is probably as quick as checking
         * if they have the class.
         */
        c = Ember.$(selectorExplorer + ' div.tab-content > #' + id);
      c.addClass('active');

      let
        /** <a> whose href matches activeId. */
        a = Ember.$('li.active-detail > a[href="#' + id + '"]'),
      /** tab element containing a.  Ensure this has .active */
      t = a.parent();
      t.addClass('active');

      if (c.length)
        console.log('didRender', id, c[0], t[0], a[0]);
    }
  }

});
