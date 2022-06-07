import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { later } from '@ember/runloop';
import { computed } from '@ember/object';
import { reads } from '@ember/object/computed';

/* global jQuery */

import { stacks } from '../../utils/stacks';

// -----------------------------------------------------------------------------

const dLog = console.debug;

const totalWidth = 12;

// -----------------------------------------------------------------------------

export default class DrawStacksFramesComponent extends Component {
  @service('data/block') block;


  constructor() {
    super(...arguments);
    this.stacks = stacks;
    // later(() => this.setSize(), 5000);
  }

  /* get stacksCount () {
    return this.block.stacksCount;
  }*/

  // @reads('stacks.stacksCount.count') stacksCount; // .length

  @computed('block.axes1d.axis1dArray.[]')  // stacksCount.  block.viewed
  get axesCount() {
    const fnName = 'axesCount';
    this.setSize();
    const viewed = this.block.viewed.length;
    // .block.axis1dReferenceBlocks.length
    const count = this.block?.axes1d?.axis1dArray?.length;
    dLog('axesCount', count, viewed, this);
    return count;
  }
  get itemWidth() {
    return this.axesCount && (totalWidth / this.axesCount);
  }

  @computed('axesCount')
  get xOffsets() {
    const
    offsets = [];
    for (let i = 0; i < this.axesCount; i++) {
      offsets.push(i * this.itemWidth);
    }
    return offsets;
  }

  setSize() {
    const
    containerId = 'holder', // stacksFrames
    container$ = jQuery('#' + containerId),
    gridStack$ = jQuery('.grid-stack');
    dLog('setSize', container$[0], gridStack$[0]);
    if (container$[0]) {
      const container = container$[0];
      if (gridStack$[0]) {
        const
        gridStack = gridStack$[0],
        style = gridStack.style;
        style.setProperty('width', container.offsetWidth + 'px');
        style.setProperty('height', container.offsetHeight + 'px');
      }
    }
  }

}

