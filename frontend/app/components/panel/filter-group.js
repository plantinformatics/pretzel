import Ember from 'ember';

export default Ember.Component.extend({
  tagName : '',

  didRender() {
    this._super(...arguments);
    let data = this.get('data');
    if (! data.component) {
      if (data.set) {
        data.set('component', this);
      } else {
        data.component = this;
      }
      /** copy initial values from data to this.
       * These are the fields defined in filter-groups.js:addFilterOrGroup() : initialFilterGroup,
       * which should be integrated with this; perhaps move initialFilterGroup to this component.
       */
      let me = this;
      [
        'filterOrGroup',
        'fieldName',
        'fieldScope',
        'fieldNamespace',
        'fieldMeta',
        'matchKey',
        'matchValue']
        .forEach(function (fieldName) {
          if (! me.get(fieldName)) {
            me.set(fieldName, data[fieldName]);
          }
        });
    }
  },

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
    if (this.get('isRegExp')) {
      match = this.get('patternsRE')
      .find(function (regexp) {
        let found = regexp.exec(a);
        if (found)
          console.log('match', regexp, a);
        return found;
      });
    }
    else
    {
      match = this.get('patterns')
      .find(function (pattern) {
        let found = a.includes(pattern);
        if (found)
          console.log('match', pattern, a);
        return found;
      });
    }
    return match;
  },

  actions : {
    changeFilterOrGroup : function () {
      let data = this.get('data'),
      value = this.get('filterOrGroup');
      console.log('changeFilterOrGroup', this, data, value);
      // this.changeFilterOrGroup(value);
      this.sendAction('changed', this);
    }
  },

  changeFilterOrGroup(value) {
    let data = this.get('data');
    this.set('filterOrGroup', value);
  }

});

