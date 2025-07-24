/*
Related to panel/select-passport-fields.
<select multiple >.   We want to assign an order to the selected items.  
One idea is to have a second list adjacent, showing the selected items, with the ability to re-order the items in this list.

===
... one `<select multiple>` allows picking items, and a second adjacent list shows **only the selected items** in **customizable order**.

### 🧩 UI Pattern: Dual List + Reordering

Here’s a breakdown of how to implement this in Ember.js:

---

### **1. Base Concept**

* Left: `<select multiple>` – shows all available options (with already selected items marked)
* Right: `<ul>` or similar – shows selected items, in **user-defined order**
* Allow reordering via:

  * drag-and-drop (using something like `ember-sortable`)
  * up/down buttons per item

---

### **2. Data Model**

Example data

```js
this.availableItems = ['apple', 'banana', 'cherry', 'date'];
this.selectedItems = ['banana', 'apple'];  // in user-defined order
```

* **Preserve order** in `selectedItems`
* Ensure it’s a subset of `availableItems`

*/
import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/**
 * @param availableItems	array of strings, from which selections are made.
 * @param selectedItems		array of strings. all items which the user has currently selected.
 */
export default class DualListComponent extends Component {

  @tracked
  availableItems;

  @tracked
  /* Copy param @selectedItems when constructed.
   * Changes are notified back to the parent component via selectedItemsNotifyChange().
   * Can use .slice() here to avoid mutating the arg.
   */
  selectedItems = this.args.selectedItems;

  /** Set by {{sortable-group onChange=this.reorder }}
   * but not displayed, so @tracked does not matter.
   */
  @tracked
  lastDragged;

  /** <select> element, initially null */
  select = null;

  @action
  /** Called when user selects an <option >.
   * @param optionValue value of the selected row
   *
   * @desc
   * For <select multiple >, after a user selection .selected is called for each
   * option value.
   */
  selected(optionValue) {
    const
    fnName = 'selected',
    selectedItems = this.args.selectedItems, 
    /** The parent component is not permitted to pass @selectedItems=undefined or
     * null; it should pass an initial value of [].
     */
    ok = selectedItems.includes(optionValue);
    // dLog(fnName, ok, selectedItems, optionValue);
    return ok;
  }

  @action
  handleSelection(event) {
    const fnName = 'handleSelection';
    dLog(fnName, event);
    this.select = event.target;
    let selected = Array.from(event.target.selectedOptions).map(o => o.value);

    // maintain order from current selectedItems when possible
    const selectedItems = this.selectedItems;
    let newOrder = selectedItems.filter(i => selected.includes(i));
    selected.forEach(i => {
      if (!newOrder.includes(i)) newOrder.push(i);
    });
    this.selectedItems = newOrder;

    /* alternative; this doesn't yet preserve order
    selectedItems.forEach(i => selected.includes(i) || selectedItems.removeObject(i));
    selected.forEach(i => selectedItems.includes(i) || selectedItems.addObject(i));
    */
    this.selectedItemsNotifyChange();
  }
  selectedItemsNotifyChange() {
    this.args.selectValueArray(/*values*/this.selectedItems, /*c*/undefined, /*add*/true);
  }
  /** reorderItems */
  @action
  reorder(itemModels, draggedModel) {
    const fnName = 'reorder';
    dLog(fnName, itemModels, draggedModel);
    this.selectedItems = itemModels;
    this.lastDragged = draggedModel;
    this.selectedItemsNotifyChange();
  }
  /** Clear the selection. */
  @action
  clearSelection() {
    const fnName = 'clearSelection';
    this.selectedItems = [];
    if (this.select) {
      for (const option of this.select.selectedOptions) {
        dLog(fnName, option);
        option.selected = false;
      };
    }
    this.selectedItemsNotifyChange();
  }
  /** Clear the selection. */
  @action
  clearOption(itemName) {
    const fnName = 'clearSelection';
    if (this.select) {
      const option = Array.from(this.select.selectedOptions).findBy('value', itemName);
        dLog(fnName, option);
        option.selected = false;
    }
  }

  // re-instate, was dropped in 338bfa97
  @action
  removeItem(item) {
    const fnName = 'removeItem';
    dLog(fnName, item);
    this.clearOption(item);

    const selectedItems = this.selectedItems;
    // this.selectedItems = selectedItems.filter(i => i !== item);
    selectedItems.removeObject(item);
    this.selectedItems = [...selectedItems];
    this.selectedItemsNotifyChange();
  }



}
