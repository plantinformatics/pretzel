
export {fileDownloadAsCSV}
/** Trigger a download of a CSV / TSV file containing the given CSV / TSV string
 *
 * Based on a post on discuss.emberjs.com by skaterdav85, May 2018 :
 * https://discuss.emberjs.com/t/whats-the-best-strategy-for-letting-users-download-ember-data-returns-as-csvs/14767/2
 */
function fileDownloadAsCSV(filename, contents) {
  const { document, URL, removeEventListener } = window;
  const anchor = document.createElement('a');
  anchor.download = filename;
  const url = anchor.href = URL.createObjectURL(new Blob([contents], {
    type: 'text/csv'
  }));

  //----------------------------------------------------------------------------

  /* In https://blog.logrocket.com/programmatically-downloading-files-browser/
   * revokeObjectURL() is wrapped in setTimeout(), possibly only because in that
   * case the <a> is clicked by a user.
   */

  //----------------------------------------------------------------------------

  document.body.appendChild(anchor);
  anchor.click();
  URL.revokeObjectURL(url);
  anchor.remove();
}
