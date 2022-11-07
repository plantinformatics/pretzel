import Model, { attr } from '@ember-data/model';

export default class DrawStackModel extends Model {
  @attr('array') axes;

  //----------------------------------------------------------------------------

  dropIn(axis1d, targetAxis1d, top) {
    const fnName = 'stack:dropIn';
    console.log(fnName, axis1d, targetAxis1d, top, this.axes.length);
    const
    /** if ! top then insert after targetAxis1d */
    insertIndex = this.findIndex(targetAxis1d) + (top ? 0 : 1);
    if (targetAxis1d === -1) {
      console.log(fnName, axis1d, targetAxis1d, this.axes);
    } else {
      this.insert(insertIndex, axis1d);
      axis1d.stack = this;
    }
  }

  dropOut(axis1d) {
    const fnName = 'stack:dropOut';
    console.log(fnName, axis1d, this.axes.length);
    this.axes.removeObject(axis1d);
    axis1d.stack = undefined;
  }

  //----------------------------------------------------------------------------

  findIndex(axis1d) {
    /** or if .axes[] contains axis-1d instead of (reference) block : (a1) => a1 */
    let index = this.axes.findIndex((b) => b.axis1d === axis1d);
    return index;
  }
  remove(index) {
    this.axes = this.axes.removeAt(index, 1);
  }
  insert(insertIndex, axis1d) {
    this.axes.insertAt(insertIndex, axis1d);
  }

  //----------------------------------------------------------------------------

}
