import Component from '@glimmer/component';
import { action } from '@ember/object';
import { debounce } from '@ember/runloop';

//------------------------------------------------------------------------------

/**
 * Component args :	
 * @param column	column definition {header, property, filterOptions }
 * @param toggleSort(property, )	set @sortBy=property, toggle @sortDir 'asc' / 'desc'.
 * @param @toggleShowFilters	toggle showFilters, which is currently per-table, not per-column
 * @param sortBy	name of field which the <table> is sorted by
 * @param sortDir	'asc' / 'desc'
 * @param selectedFieldValuesTexts	
 * @param showFilters	
 * @param selectFieldValue	
 * @param selectedFieldValues	
 * @param nameFilterChanged	action ([key, value]) to signal to parent that
 * user has entered value in column with property key.
 */
export default class EmberMulti2ColumnComponent extends Component {

  //------------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.emberMulti2Column = this;
    }
  }

  //------------------------------------------------------------------------------

  /** This was used to support <input  ... value={{this.nameFilter}} >
   * which reads `get`, does not use `set`.
   *
   * Now instead the <input> uses debounce which sets this.nameFilter via
   * nameFilterChanged() :
   * <input id="nameFilter" ...
   * value={{@column.namesFilters.nameFilterDebounced}}
      oninput={{this.nameFilterChangedDebounce}} ... >
   */
  get nameFilter() {
    const
    column = this.args.column,
    value = column.fieldSearchString[column.property];
    return value;
  }
  set nameFilter(value) {
    const
    column = this.args.column;
    column.fieldSearchString[column.property] = value;
  }



  @action
  nameFilterChangedDebounce(event) {
    debounce(this, this.nameFilterChanged, event, 800);
  }
  @action
  nameFilterChanged(event) {
    const value = event.target.value;
    console.log('nameFilterChanged', value);
    this.nameFilter = value;
    const column = this.args.column;
    column.namesFilters.nameFilterChanged(value);
    this.args.nameFilterChanged([column.property, value]);
  }

  //------------------------------------------------------------------------------


  @action
  /** This is the same as the {{get object fieldName}} helper, except it treats
   * '.' in fieldName as part of the name instead of a object path divider.
   * e.g. countryOfOrigin.name and crop.name are handled correctly.
   *
   * Used for object === {@selectedFieldValues,@selectedFieldValuesTexts}, with
   * propertyName === @column.property.
   * Based on ember-multi2-table.js : getRowProperty().
   */
  getProperty(object, propertyName) {
    let value = object[propertyName];
    return value;
  }

}
