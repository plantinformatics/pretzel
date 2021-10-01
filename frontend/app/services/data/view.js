import Service, { inject as service } from '@ember/service';
import { later } from '@ember/runloop';
import { alias } from '@ember/object/computed';

import { storageFor } from 'ember-local-storage';


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

  blockViewHistory: storageFor('blockViewHistory'),

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
      /** record the viewed event in history */
      this.setViewed(block);
    }
    let referenceBlock = block.get('referenceBlock');
    if (referenceBlock && (referenceBlock !== block)) {
      toView.push(referenceBlock);
      related.push(referenceBlock);
      this.setViewed(referenceBlock);
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
        this.setViewed(parentBlock);
      }
    }
    if (toView.length) {
      later(() => toView.forEach((block) => block.set('isViewed', true)));
    }

    return related;
  },


  /** Map by block : counter / timestamp
   * Used to filter/sort for Dataset Explorer : Recent / Favourites
   */
  /** map Block.id -> {counter, timestamp}. singleton map. */
  viewed : alias('blockViewHistory.viewed'),
  viewedClear() {
    dLog('viewedClear', this.viewed);
    this.blockViewHistory.set('viewed', {});
  },

  setViewed(block) {
    let
    map = this.get('viewed') || this.set('viewed', {}),
    key = block.id,
    entry = map[key],
    now = Date.now();
    if (entry) {
      entry.counter++;
    } else {
      entry = {counter : 1};
      map[key] = entry;
    }
    entry.timestamp = now;

    // update blockViewHistory to cause export to localStorage
    this.blockViewHistory.set('viewed', this.viewed);
  },
  /** @return true if the block has view history. */
  blockViewed(block) {
    return this.viewed[block.id];
  },
  /** Sort (descending) the given array of blocks.
   * @param recent  true / false for recent / favourite,
   * i.e. true means sort by .timestamp, false means sort by .counter.
   */
  blocksFilterSortViewed(blocks, recent) {
    let
    keyName = recent ? 'timestamp' : 'counter',
    /** descending : bv2 - bv1  */
    blocksSorted = blocks
      .map((b) => [b, this.blockViewed(b)])
      .filter((bv) => bv[1])
      .sort((bv1, bv2) => (bv2[1][keyName] - bv1[1][keyName]))
      .map((bv) => bv[0]);
    return blocksSorted;
  },
  /** Sort (descending) the given array of datasets.
   * Sort by the datasets' blocks, based on their viewed history.
   * @param recent  true / false for recent / favourite,
   * i.e. true means sort by .timestamp, false means sort by .counter.
   */
  datasetsFilterSortViewed(datasets, recent) {
    let
    keyName = recent ? 'timestamp' : 'counter',
    /** descending : dv2 - dv1  */
    datasetsSorted = datasets
      .map((d) => [d, this.datasetMaxViewed(d, recent)])
      .filter((dv) => dv[1])
      .sort((dv1, dv2) => (dv2[1][keyName] - dv1[1][keyName]))
      .map((dv) => dv[0]);
    return datasetsSorted;
  },
  /** @return the max viewedHistoryEntry of dataset's blocks,
   * or undefined if none have been viewed.
   */
  datasetMaxViewed(dataset, recent) {
    let
    blockEntries = this.datasetBlocksViewed(dataset),
    /** viewedHistoryEntry */
    max = this.maxViewed(blockEntries, recent);
    return max;
  },           
  /** Given an array of viewedHistoryEntry,
   * where viewedHistoryEntry is : {counter, timestamp} of that block,
   * find the entry with the maximum value of viewedHistoryEntry.counter or .timestamp
   * @param recent  true / false for recent / favourite,
   * i.e. true means select the max .timestamp, false means select the max .counter.
   * @return the max viewedHistoryEntry
   * or undefined if blockEntries is []
   */
  maxViewed(blockEntries, recent) {
    let
    keyName = recent ? 'timestamp' : 'counter',
    blockEntryMax = blockEntries.length ? blockEntries
      .reduce(
        (maxEntry, entry) => (maxEntry[keyName] > entry[keyName]) ? maxEntry : entry,
        blockEntries[0])
      : undefined;
    return blockEntryMax;
  },
  /** @return the block entry of this dataset, if any, which is most recent or favourite,
   * or if recent is null just return true / false if any block of this dataset
   * has a viewed history entry.
   */
  datasetHistory(dataset, recent) {
    let
    entry,
    datasetEntries = this.datasetBlocksViewed(dataset),
    blocks = dataset.get('blocks');
    if (recent === null) {
      entry = blocks.any((b) => this.blockViewed(b));
    }
    blocks.filter((b) => this.blockViewed(b));
    return ;
  },
  /** @return  true if any blocks of this dataset have been viewed.
   */
  datasetViewed(dataset) {
    return dataset.get('blocks').any((b) => this.blockViewed(b));
  },
  /** @return the view history entries of the blocks of this dataset
   */
  datasetBlocksViewed(dataset) {
    let
    entries = 
      dataset.get('blocks').reduce((es, b) => {
        let e = this.blockViewed(b);
        if (e) { es.push(e); };
        return es; }, []);
    return entries;
  }

});
