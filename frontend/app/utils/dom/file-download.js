//------------------------------------------------------------------------------

/* global Blob */
/* global removeEventListener */
/* global document */
/* global URL */
/* global CompressionStream */
/* global Response */

//------------------------------------------------------------------------------

export {fileDownloadBlob, fileDownloadAsCSV}
/** Trigger a download of a file containing the given data blob.
 *
 * fileDownloadBlob() and fileDownloadAsCSV() are partly based on a post on discuss.emberjs.com by skaterdav85, May 2018 :
 * https://discuss.emberjs.com/t/whats-the-best-strategy-for-letting-users-download-ember-data-returns-as-csvs/14767/2
 *
 * @param filename  string
 * @param blob
 */
function fileDownloadBlob(filename, blob) {
  const { document, URL, removeEventListener } = window;
  const anchor = document.createElement('a');
  anchor.download = filename;
  const url = anchor.href = URL.createObjectURL(blob);

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
/** Trigger a download of a CSV / TSV file containing the given CSV / TSV string
 *
 * @param filename  string
 * @param type  default is 'text/csv'
 */
function fileDownloadAsCSV(filename, contents, type = 'text/csv') {
  const blob = new Blob([contents], { type });
  fileDownloadBlob(filename, blob);
}

//------------------------------------------------------------------------------

export { exportAsCSVFile }
/**
 * @param fileName
 * @param data  array of features
 * @param keyArray  keys for features
 * @param columnHeaders mostly the same as keyArray, but e.g. feature table uses
 * 'Block' instead of 'Chromosome'.
 * @param quoteIfNeeded (value, columnIndex) => value or quoted string if value
 * should be wrapped with quotes because it contains commas which would split
 * the CSV columns
 */
function exportAsCSVFile(fileName, data, keyArray, columnHeaders, quoteIfNeeded) {

  const
  datasetStrings = data
    .map(d =>
      keyArray
        .map(key => d[key])
        .map((value, columnIndex) => (value ?? false) ? quoteIfNeeded(value, columnIndex) : '')
        .join(',')
    ),
  csv = [columnHeaders.join(',')].concat(datasetStrings)
    .join('\n');

  fileDownloadAsCSV(fileName, csv);

}

//------------------------------------------------------------------------------

export { text2Gzip }
/** Compress the given string, and return content for a .gz file download
 * @return promise yielding a blob, of gzip data
 */
function text2Gzip(contents, type = 'text/csv') {
  const
  stream = new CompressionStream("gzip"),
  blob = new Blob([contents], { type  }),
  compressedStream = blob.stream().pipeThrough(stream),
  promise = new Response(compressedStream).blob();

  return promise;

}
