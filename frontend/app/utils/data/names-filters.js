import EmberObject, { computed } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import { debounce as lodash_debounce } from 'lodash/function';

//------------------------------------------------------------------------------


const dLog = console.debug;

const trace = 0;

//------------------------------------------------------------------------------

export default class NamesFilter extends EmberObject {

  /** Set by input component / element */
  @tracked
  nameFilter = '';

  /** debounced value of .nameFilter */
  @tracked
  nameFilterDebounced = '';

  constructor() {
    super(...arguments);

    if (trace) {
      dLog('names-filters', 'constructor', 'this', this);
    }
  }

  nameFilterChanged(value) {
    // dLog('nameFilterChanged', value);
    // debounce(this, this.nameFilterChangedSet, 2000);
    // use lodash_debounce() instead because it has option : leading
    this.nameFilterDebouncedLodash(value);
  }

  @computed
  get nameFilterDebouncedLodash() {
    /** leading:true seems to allow rapid events through, not debounced. */
    const debounced = lodash_debounce(this.nameFilterChangedSet, 500, { maxWait: 2000, /*leading: true*/ });
    return debounced;
  }

  @computed
  get nameFilterChangedSet() {
    /**
     * @param value
     * value is set on .nameFilter via : {{input id="nameFilter" }} in manage-explorer.hbs,
     * and is passed via nameFilterDebouncedLodash(value) for other uses.
     */
    const fn = (value) => {
      dLog('nameFilterChangedSet', 'set', value, this.nameFilter);
      this.nameFilterDebounced = value ?? this.nameFilter;
    };
    return fn;
  }

  @computed('nameFilterDebounced')
  get nameFilterArray() {
    const
    nameFilter = this.get('nameFilterDebounced'),
    array = !nameFilter || (nameFilter === '') ? [] :
      nameFilter.split(/[ \t]/);
    return array;
  }

  /** @return a function to convert a string param to lower case if caseInsensitive.
   */
  maybeLC(caseInsensitive) {
    const maybeLC = caseInsensitive ? (string) => string.toLowerCase() : (string) => string;
    return maybeLC;
  }

  /** As for maybeLC(), applied to an array of strings
   */
  maybeLCArray(caseInsensitive, nameFilters) {
    if (caseInsensitive) {
      const maybeLC = this.maybeLC(caseInsensitive);
      /** this can be factored out a couple of levels. */
      nameFilters = nameFilters.map(maybeLC);
    }
    return nameFilters;
  }

  /** Apply nameFilters[] to the given name.
   * @return true if each / any of the name keys matches name
   * @param name  text name of e.g. Trait
   * @param caseInsensitive true if Search Filter is case insensitive.
   * @param searchFilterAll
   * indicates how to match search/filter which has multiple strings (space-separated).
   * The dataset is considered to match if :
   *   true : all
   *   false : any
   *  of the search key-words match.
   * @param nameFilters array of text to match against name
   */
  matchFilters(name, nameFilters, caseInsensitive, searchFilterAll) {
    const
    maybeLC = this.maybeLC(caseInsensitive),
    nameMaybeLC = maybeLC(name),
    multiFnName = searchFilterAll ? 'every' : 'any',
    nameFiltersMaybeLC = this.maybeLCArray(caseInsensitive, nameFilters),
    matchAll = nameFiltersMaybeLC[multiFnName]((nameFilter) => {
      const
      match = nameMaybeLC.includes(nameFilter);
      return match;
    });
    return matchAll;
  }

  /**  Apply nameFilters[] to .name of the given object, and to the names of its child objects.
   * @return true if each / any of the name keys matches name
   * @param object match .name of object
   * @param nameFilters array of text to match against name
   * @param caseInsensitive true if Search Filter is case insensitive.
   * @param searchFilterAll
   * indicates how to match search/filter which has multiple strings (space-separated).
   * The dataset is considered to match if :
   *   true : all
   *   false : any
   *  of the search key-words match.
   * @param childNamesFn  also match if any child of object matches
   * signature : object -> name []
   */
  matchFiltersObj(object, nameFilters, caseInsensitive, searchFilterAll, childNamesFn) {
    const
    maybeLC = this.maybeLC(caseInsensitive),
    nameMaybeLC = maybeLC(object.name),
    multiFnName = searchFilterAll ? 'every' : 'any',
    nameFiltersMaybeLC = this.maybeLCArray(caseInsensitive, nameFilters),
    matchAll = nameFiltersMaybeLC[multiFnName]((nameFilter) => {
      let
      match = nameMaybeLC.includes(nameFilter);
      if (! match && childNamesFn) {
        match = childNamesFn(object).any((block) => maybeLC(block).includes(nameFilter));
      }
      return match;
    });
    return matchAll;
  }


}
