import Component from '@glimmer/component';

import { action } from '@ember/object';

import { thenOrNow } from '../../utils/common/promises';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------

/** Based on a <select multiple>, provide notification when values are de/selected.
 *
 * @param values  array of values to populate the <select> <option>s
 *  an array of optionValue {id, name}.
 * @param selectedValues is updated with the values selected by the user
 * @param selectValueArray(values, c, add)
 *   values : current list of selected values;
 *   c : element de/selected in the current event
 *   add : true if c was selected
 * 
 * Provide notification when values are de/selected, via
 *  .selectedGroupChangedId() -> selectedValueChanged() -> @selectValueArray()
 *  (or equivalent @selectedGroupChanged()).
 */
export default class FormSelectMultipleComponent extends Component {
  // selectedValue;

  /** The options of <select> which were selected before the current click. */
  selectedOptionsPrevious = new Set();

  /** Receive the onchange event.
   *
   * The event.target.value when <select> has 'multiple' attribute is just the
   * first of the currently selected options (after the current click).
   * So it is necessary to monitor select.selectedOptions for changes.
   *
   * This is done by storing the previous set of .selectedOptions in
   * this.selectedOptionsPrevious, and passing the difference (added & deleted)
   * to the given @selectedGroupChanged().
   *
   * @param event
   */
  @action
  selectedGroupChangedId(event) {
    const fnName = 'selectedGroupChangedId';
    let
    /** select-group.js handles @values optionally being a promise at this
     * point; that is not required for haplotypes-samples. */
    gsP = this.args.values,
    selectedGroup = thenOrNow(gsP, (gs) => {
      const
      select = event.target,
      /** may pass this to selectedValueChanged(). */
      currentText = Array.from(select.selectedOptions).mapBy('value'),
      current = new Set(currentText),
      previous = this.selectedOptionsPrevious,
      addedSet = current.difference(previous),
      deletedSet = previous.difference(current),
      valueForId = id => gs.findBy('id', id),
      added = Array.from(addedSet).map(valueForId),
      deleted = Array.from(deletedSet).map(valueForId);
      this.selectedOptionsPrevious = current;
      dLog(fnName, select.value);
      /* haplotypes-samples.hbs passed @selectedGroupChanged until d1f45ed9,
       * which changed it to pass @selectValueArray=this.selectedHaplotypeChanged
       * (reduced to just .selectSampleArray).
       * because this.selectedValueChanged() is copied from haplotypes-samples.js.
       */
      if (this.args.selectedGroupChanged) {
        this.args.selectedGroupChanged(added, deleted);
      } else {
        this.selectedValueChanged(added, deleted);
      }
    });
  }

  /** Called via user selection change in select-multiple
   * The parameters added and deleted indicate changes to the selection.
   * They are arrays of :
   *  { id, name, ... } Ember Object
   * See form/select-multiple.js : selectedGroupChangedId().
   *
   * @param added
   * @param deleted
   *
   * based on manage-explorer.js : selectedCategoryChanged()
   */
  @action
  selectedValueChanged(added, deleted) {
    const fnName = 'selectedValueChanged';

    const isMultiple = true;
    /* This would only be relevant if multiple was not used.
    if (selectedValue === noValue) {
      this.valuesSelected = null;
    } else if (! isMultiple) {
      this.valuesSelected = selectedValue;
    } else */ {
      const
      values = this.args.selectedValues;
      /** or c === selectedValue */
      // present = values.find(c => c.id == selectedValue.id);
      /** use .pushObject() (or .removeObject) so that uses of @selectedValues
       * as a dependency will update, e.g. select-passport-fields.hbs depends on
       * .passportFields.length to enable button .updateAndClose.
       * haplotypesSelected.length is not currently a dependency.
       */
      const
      /** changes[add=true] === added. */
      changes = [deleted, added];
      /** delete then add. */
      [false, true].forEach(add => {
        const change = changes[+add];
        change.forEach(c => {
          /* The original use of select-multiple before c43e8f41 had a fixed
           * array for @values, but select-passport-fields generates the list
           * passed to @values, so it is necessary to use .findBy('id'). */
          const existing = values.findBy('id',  c.id);
          if (add) {
            if (! existing) {
              values.pushObject(c);
            }
          } else {
            values.removeObject(existing);
          }
          this.args.selectValueArray(values, c, add);
        });
      });
    }
    dLog(fnName, added.mapBy('id'), deleted.mapBy('id'), this.args.selectedValues.mapBy('id'));
  }


  @action
  /** Called when user selects an <option >.
   * @param optionValue {id, name} of the selected row
   *
   * @desc
   * For <select multiple >, after a user selection .selected is called for each
   * option value.
   */
  selected(optionValue) {
    const
    fnName = 'selected',
    selectedValues = this.args.selectedValues, 
    /** The parent component is not permitted to pass @selectedValues=undefined or
     * null; it should pass an initial value of [].
     */
    ok = selectedValues.any(s => s.id === optionValue.id);
    // dLog(fnName, ok, selectedValues, optionValue);
    return ok;
  }
}
