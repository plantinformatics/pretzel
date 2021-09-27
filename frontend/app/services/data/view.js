import Service, { inject as service } from '@ember/service';
import { later } from '@ember/runloop';


/*----------------------------------------------------------------------------*/

const dLog = console.debug;

/*----------------------------------------------------------------------------*/

/** Manage the blocks which are viewed in the draw-map.
 *
 * Some related functions are in ./block.js
 * Also : controllers/mapview.js:viewDataset() can probably move here and replace :
 * components/panel/upload/{blast-results.js,file-drop-zone.js}:unviewDataset()
 * Related :
 * services/data/block.js : getIsViewed(), setViewed().
 * models/block.js : unViewChildBlocks()
 */
export default Service.extend({
  block : service('data/block'),

  /** When a block is viewed, its .referenceBlock is viewed, which provides the
   * axis, and if it has a .parentBlock which is different, that is viewed also;
   * this is a user requirement not a functional requirement.
   * This map records that association, so that when the block is unviewed, the
   * .parentBlock can be unviewed also.
   * Map from one block to another if the latter was viewed as a result of the
   * former being viewed.
   */ 
  viewedFor : new Map(),
  /** Record that parent was viewed because child was viewed.
   * When the child is un-viewed, the parent will be unviewed also.
   * @param child, parent blocks
   */
  setViewedFor(child, parent) {
    this.viewedFor.set(child, parent);
  },
  /** Lookup the .viewedFor map for child, and return any associated block
   * (.parentBlock), and clear that association; the caller will unview the
   * blocks.
   */
  unviewFor(child) {
    let parent = this.viewedFor.get(child);
    if (parent) {
      this.viewedFor.set(child, undefined);
    }
    return parent;
  },

  /** The user has requested that block be viewed; also view its .referenceBlock
   * (if any) and .parentBlock (if different).
   * @return related blocks for which the caller (mapview : loadBlock)
   * should do useTask: getBlocksSummary(), ensureFeatureLimits(),
   */
  viewRelatedBlocks(block) {
    let toView = [];
    let related = [];
    if (! block.get('isViewed')) {
      toView.push(block);
    }
    let referenceBlock = block.get('referenceBlock');
    if (referenceBlock && (referenceBlock !== block)) {
      toView.push(referenceBlock);
      related.push(referenceBlock);
    }
    /** Also view the parent, if that is different from the reference.
     * In this case block and referenceBlock are already covered,
     * so block.parentAndGP() is not required.
     */
    if (block.get('datasetId.parent.parent')) {
      let parentBlock = block.get('parentBlock');
      if (parentBlock && ! parentBlock.get('isViewed')) {
        related.push(parentBlock);
        toView.push(parentBlock);
        this.setViewedFor(block, parentBlock);
      }
    }
    if (toView.length) {
      later(() => toView.forEach((block) => block.set('isViewed', true)));
    }

    return related;
  },

});
