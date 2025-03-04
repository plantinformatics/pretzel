/** based on :
 * https://chatgpt.com/c/67c64e3d-f13c-800e-849e-8252359c0216   OpenAI ChatGPT 4o, 2025Mar04
 * With several changes :
 *  set .textContent instead of CSS width, height
 *  only insert handle in col -1
 *  update settings.columnHeaderHeight


Prompt: When using the frontend JavaScript GUI library HandsOnTable, is there a way to add a resize handle element which the user can click and drag to resize the height of the column headers ?

Answer:
Handsontable does not natively provide a built-in feature for resizing column headers' height using a drag handle, but you can implement it using a custom approach with JavaScript and CSS. Here’s how you can achieve this:

### **Approach**
1. Add a resize handle element inside the header cells.
2. Listen for mouse events (`mousedown`, `mousemove`, `mouseup`) to adjust the height dynamically.
3. Update the Handsontable header row height accordingly.

### **Explanation**
- Each column header gets a small **resize handle** at the bottom.
- When the user **clicks and drags** the handle, the height of all header cells is adjusted dynamically.
- **Event listeners (`mousedown`, `mousemove`, `mouseup`)** handle the resizing.
- The `afterGetColHeader` hook ensures each header gets a resize handle.

This method should allow users to resize the column headers interactively.

*/
/*
document.addEventListener("DOMContentLoaded", function () {
  const hot = new Handsontable(document.getElementById("hot"), {
    data: Handsontable.helper.createSpreadsheetData(5, 5),
    rowHeaders: true,
    colHeaders: true,
    manualColumnResize: true,
*/

/** Lookup the n-th .parentElement of element
 * @param n number of levels to step up towards root
 */
function parentElementN(element, n) {
  if (n > 0) {
    while (element && (n-- > 0)) {
      element = element.parentElement;
    }
  }
  return element;
}
export { afterGetColHeader }
function afterGetColHeader(col, TH) {
  /* first call is within ht_master; wait for ht_clone_top where it will be visible. */
  const
  table = this;
  // Add just in column -1 (left-most)
  // Prevent multiple handles
  if ((col >= 0) || TH.querySelector(".resize-handle")) return;

  // Create the resize handle
  const handle = document.createElement("div");
  handle.classList.add("resize-handle");
  handle.textContent = '⇅';
  TH.appendChild(handle);

  let isResizing = false;
  let startY, startHeight;

  handle.addEventListener("mousedown", (event) => {
    isResizing = true;
    startY = event.clientY;
    startHeight = TH.offsetHeight;

    document.addEventListener("mousemove", resize);
    document.addEventListener("mouseup", stopResize);
  });

  function resize(event) {
    if (!isResizing) return;

    /** prevent table selection */
    event.preventDefault(); // Cancel the native event
    event.stopPropagation();// Don't bubble/capture the event any further

    // Disable Handsontable selection
    table.updateSettings({ disableVisualSelection: true });

    const newHeight = Math.max(20, startHeight + event.clientY - startY);
    document.querySelectorAll(".handsontable thead th").forEach((th) => {
      th.style.height = `${newHeight}px`;
    });

    const settings = { columnHeaderHeight : newHeight };
    table.updateSettings(settings);

  }

  function stopResize() {
    isResizing = false;
    document.removeEventListener("mousemove", resize);
    document.removeEventListener("mouseup", stopResize);

    // Re-enable Handsontable selection
    table.updateSettings({ disableVisualSelection: false });
  }
}

/*,
  });
});
*/
/*
```

### **CSS for Resize Handle**
```css
.resize-handle {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 5px;
  cursor: ns-resize;
  background: rgba(0, 0, 0, 0.1);
}
.resize-handle:hover {
  background: rgba(0, 0, 0, 0.3);
}
*/


/** Update setting `name` to `value`.
 * @param table HandsOnTable handle
 */
function tableUpdateSetting(table, name, value) {
  const
  settings = {name : value };
  table.updateSettings(settings);
}
