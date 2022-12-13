import { alias } from '@ember/object/computed';

//------------------------------------------------------------------------------

import {
  Block,
} from '../stacks';

//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

const Block_p = Block.prototype;


/** Supporting the display of a block in an axis.
 */
export default class BlockAxisView {

  constructor(block) {
    const
    /** provide .axisName for code in draw-map which may handle axes or blocks */
    axisName = block.get('id');
    this.axisName = axisName;
    this.block = block;
    /** .visible indicates the features of this block will be included in axis brushes & paths.  */
    this.visible = true;
  }

  /** mix-in selected functions from Block:
   * fgrep Block.prototype stacks.js 
   *  (replace-regexp ".*\\.\\([a-zA-Z0-9_]+\\) = function.*" "    \\1 = Block_p.\\1;")
   */
  getId = Block_p.getId;
  setAxis = Block_p.setAxis;
  getAxis = Block_p.getAxis;
  getStack = Block_p.getStack;
  log = Block_p.log;
  longName = Block_p.longName;
  isReference = Block_p.isReference;
  datasetHasParent = Block_p.datasetHasParent;
  isData = Block_p.isData;
  yOffset = Block_p.yOffset;
  features = Block_p.features;
  domainCalc = Block_p.domainCalc;
  maybeDomainCalc = Block_p.maybeDomainCalc;
  titleText = Block_p.titleText;
  axisTitleColour = Block_p.axisTitleColour;
  axisTransformO = Block_p.axisTransformO;

  //----------------------------------------------------------------------------

  // .axisName is this.block.get('id')
  // @alias('block.axisName') axisName;
  @alias('block') z;
  
  longName() {
    const
    parent = this.block.referenceBlock,
    name = this.axisName + ':' + this.block.get('name')
      + '/' + (parent ? parent.axisName : '');
    return name;
  };

  /** supporting the Block interface : Block .parent is undefined or the
   * reference block, which is .axis.blocks[0] */
  @alias('block.referenceBlock.view') parent;
 
}

//------------------------------------------------------------------------------
/** static functions */

/* fgrep Block. frontend/app/utils/stacks.js  | fgrep -v prototype
   (replace-regexp "^Block.\\(.+\\) = function (.*"  "    BlockAxisView.\\1 = Block.\\1;")
*/
// BlockAxisView.longName = Block.longName;
BlockAxisView.axisName_parent = Block.axisName_parent;
BlockAxisView.titleTextMax = Block.titleTextMax;
BlockAxisView.axisTitleColour = Block.axisTitleColour;

//------------------------------------------------------------------------------
