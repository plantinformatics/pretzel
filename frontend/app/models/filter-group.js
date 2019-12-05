import Ember from 'ember';
import DS from 'ember-data';

const trace_FG = 0;

const fieldNames=[
  'filterOrGroup',
  'applyDataset',
  'applyBlock',
  'fieldName',
  'fieldScope',
  'fieldNamespace',
  'fieldMeta',
  'matchKey',
  'matchValue',
  'pattern'
];

/** FilterGroup
 * A FilterGroup can be restricted to apply only at the dataset or block level.
 * manage-explorer computes a list of each type of FilterGroup.
 *
 * @param applyDataset  true means apply this FilterGroup to the Dataset level
 * @param applyBlock  true means apply this FilterGroup to the Block level
 */
export default DS.Model.extend({

  /** value is 'filter' or 'group' */
  filterOrGroup: 'filter',
  applyDataset : true,
  applyBlock : true,
  fieldName : true,
  fieldScope : true,
  fieldNamespace : true,
  fieldMeta : true,
  matchKey : true,
  matchValue : true,
  pattern : undefined,

  toString : function() {
    console.log('FilterGroup : toString()', this);
    let texts = fieldNames.map((n) => this[n] )
      .filter((v) => v !== undefined);
    return "FilterGroup:" + texts.join(',');
  },

  /** @return true if this filterGroup is defined and it is a filter not a grouping. */
  isFilter : Ember.computed('defined', 'filterOrGroup', function () {
    let
      defined = this.get('defined'),
    isFilter = this.get('filterOrGroup') === 'filter';
    return isFilter;
  }),

  patterns : Ember.computed('pattern', function () {
    let
      pattern = this.get('pattern'),
    patterns;
    if (pattern)
      patterns = pattern
      .split(/[ \n\t]+/);
    console.log('patterns', pattern, patterns);
    return patterns;
  }),
  patternsRE : Ember.computed('patterns', 'patterns.[]', function () {
    let patterns = this.get('patterns'),
    patternsRE = this.get('isRegExp') ?
      patterns.map(function (p) { return new RegExp(p); })
    : [];
    console.log('patternsRE', patterns, patternsRE);
    return patternsRE;
  }),
  /** @return true if the user has entered information which defines filter / grouping.
   */
  defined : Ember.computed('pattern', 'pattern.[]', 'filterOrGroup', function () {
    let pattern = this.get('pattern'),
    /** possibly grouping does not need a pattern - can group on fieldName,fieldScope,fieldMeta */
    isFilter = this.get('filterOrGroup') === 'filter',
    defined = isFilter ? pattern && pattern.length : true;
    return defined;
  }),

  /** @return true if string a matches any of the patterns of this filterGroup
   *
   * apply this.pattern to string a.
   * this.get('isRegExp') indicates if pattern is a regular expression or a string
   * @return true if match
   */
  match : function (a) {
    let match;
    /** isCaseSensitive is currently applied to string patterns, not regular expressions. */
    let isCaseSensitive = this.get('isCaseSensitive');
    if (this.get('isRegExp')) {
      match = this.get('patternsRE')
      .find(function (regexp) {
        let found = regexp.exec(a);
        if (found && trace_FG)
          dLog('match', regexp, a);
        return found;
      });
    }
    else
    {
      if (! isCaseSensitive)
        a = a.toLowerCase();
      match = this.get('patterns')
      .find(function (pattern) {
        if (! isCaseSensitive)
          pattern = pattern.toLowerCase();
        let found = a.includes(pattern);
        if (found && trace_FG)
          dLog('match', pattern, a);
        return found;
      });
    }
    return match;
  }



});

