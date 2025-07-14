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

  @action
  handleSelection(event) {
    const fnName = 'handleSelection';
    dLog(fnName, event);
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

  @action
  moveUp(index) {
    const fnName = 'moveUp';
    dLog(fnName, index);

    if (index > 0) {
      const selectedItems = this.selectedItems;
      [selectedItems[index - 1], selectedItems[index]] = [selectedItems[index], selectedItems[index - 1]];
      this.selectedItems = [...selectedItems]; // trigger reactivity
      this.selectedItemsNotifyChange();
    }
  }

  @action
  moveDown(index) {
    const fnName = 'moveDown';
    dLog(fnName, index);

    const selectedItems = this.selectedItems;
    if (index < selectedItems.length - 1) {
      [selectedItems[index + 1], selectedItems[index]] = [selectedItems[index], selectedItems[index + 1]];
      this.selectedItems = [...selectedItems];
      this.selectedItemsNotifyChange();
    }
  }

  @action
  removeItem(item) {
    const fnName = 'removeItem';
    dLog(fnName, item);

    const selectedItems = this.selectedItems;
    // this.selectedItems = selectedItems.filter(i => i !== item);
    selectedItems.removeObject(item);
    this.selectedItems = [...selectedItems];
    this.selectedItemsNotifyChange();
  }

}
