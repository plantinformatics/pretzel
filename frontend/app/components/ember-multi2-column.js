import Component from '@glimmer/component';


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

}
