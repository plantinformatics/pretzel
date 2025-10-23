// from https://chatgpt.com/c/68e87dd1-216c-8323-b259-0bbe148965ff
// app/components/infinite-table.js
import EmberObject from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { task, timeout } from 'ember-concurrency';
import { action } from '@ember/object';

/** Genolink / Genesys page numbering starts at 0. */
const startPage = 0;

/** Read a data source in pages.
 * Results are accumulated in an array which is used in table display
 * (passport-table, ember-multi2-table)
 *
 * Initial draft generated via ChatGPT
 * https://chatgpt.com/share/68e89727-f3c4-800e-a7bc-f4cf4f725b4a
 */
export default class PagedData extends EmberObject {
  @tracked rows = [];
  @tracked page = startPage;  // generated : 1
  /** Default Genolink / Genesys page length is 100 */
  @tracked pageSize = 100;  // generated : 50
  @tracked hasMore = true;
  @tracked isFirstLoad = true;

  //----------------------------------------------------------------------------

  /**
   * @param searchName	text identifying searchKV
   * @param searchKV	{key, value}, i.e. search field and value search string to match.
   * .pages is added to searchKV by loadPage().
   * @param getPage	action to get next page of search results
   */
  constructor(searchName, searchKV, getPage) {
    super(...arguments);

    this.searchName = searchName;
    this.searchKV = searchKV;
    this.getPage = getPage;
    // Optional: kick off initial load when component first renders
    this.refresh();
  }

  //----------------------------------------------------------------------------

  // Choose a policy:
  // - restartable: cancel an in-flight request when a new one starts (good for “jump to” paging)
  // - drop: ignore new triggers while one is running (good to resist rapid scroll spam)
  // - enqueue: queue them (rarely necessary for paging)
  @(task({ drop: true /* restartable : true*/ })) *loadPage({ page = this.page } = {}) {
    // Optional: small debounce to smooth rapid triggers
    yield timeout(80);

    // Example with fetch; swap for Ember Data: this.store.query('model', { page, size })
    const controller = new AbortController();
    try {
      // could pass controller.signal to getPassportData{,Chunk}.
      const dataArray = yield this.getPage(this.searchKV, page);
      /* generated :
         // Expect { data: [...], meta: { hasMore: boolean } } or similar
         resp = yield fetch(
        `/api/items?page=${page}&size=${this.pageSize}`,
        { signal: controller.signal }
      )
       .then(r => r.json());
       const data = resp.data;
      */
      /** result is in chunks (just 1 chunk if _text). */
      const data = dataArray.flat();
      if (page === startPage) {
        this.rows = data;
      } else {
        this.rows = [...this.rows, ...data];
      }
      if (this.searchKV) {
        const cache = this.searchKV.pages || (this.searchKV.pages = {});
        cache[page] = data;
      }

      this.page = page;
      /** Provision for getPage() to indicate when the received result is the
       * last page, using Symbol to carry an out-of-band signal. */
      const hasMore = dataArray[Symbol.for('hasMore')]; // generated : resp.meta?.hasMore
      this.hasMore = hasMore ?? (data.length >= this.pageSize);
      this.isFirstLoad = false;
    } finally {
      // If the task is cancelled, `fetch` gets aborted automatically via the signal
      controller.abort();
    }
  }

  @action
  loadNextPage() {
    let promise;
    if (this.hasMore && !this.loadPage.isRunning) {
      promise = this.loadPage.perform({ page: this.page + 1 });
    } else {
      promise = this.loadPage.lastPerformed;
    }
    return promise || Promise.resolve();
  }

  @action
  refresh() {
    this.page = startPage;
    this.hasMore = true;
    this.isFirstLoad = true;
    this.loadPage.perform({ page: startPage });
  }
}
