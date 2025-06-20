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

//------------------------------------------------------------------------------

export { exportObjectsAsCSVFile };
/** Generate a CSV / TSV report of the datasets visible to this user, and
 * export as a file download.
 * @param fileName
 * @param needsQuoting	(key, value, columnIndex) => boolean
 * The result indicates if the given key / value / columnIndex should be wrapped with
 * "". Otherwise if it is an array it will be joined with ',' and wrapped with
 * "", otherwise it will be unchanged.
 * @param baseColumnHeaders
 * Array of strings. Left-most column headings.
 * If ! useAllKeys, this will be used for keyArray also
 * @param useAllKeys	If true, collate the key names of all objects in data[],
 * and append them to baseColumnHeaders to form columnHeaders.
 * @param columnHeadersMap	if defined and useAllKeys, use this to optionally
 * rename some columnHeaders.
 * This is to support the mapping of columnHeaders[0] 'Chromosome' -> 'Block'
 * when called from table-brushed.js; it might have more general uses.
 * @param data	array of objects [{key : value, ...}, ... ]
 */
function exportObjectsAsCSVFile(fileName, needsQuoting, baseColumnHeaders, useAllKeys, columnHeadersMap, data) {
  /** This function is factored from components/table-brushed.js :
   * downloadCSVFile(), and is designed to support that use case.
   */
  let columnHeaders;
  const
  fnName = 'exportObjectsAsCSVFile',
  quoteIfNeeded = (value, columnIndex) =>
  needsQuoting(columnHeaders[columnIndex], value, columnIndex) ? '"' + value + '"' :
    Array.isArray(value) ?  '"' + value.join(',') +  '"' :
    value;

  let featureKeyArray;
  if (useAllKeys) {
    const
    /** result : S alias s.  d : row datum, k : cell key */
    featureKeySet = data.reduce((S, d) =>
      Object.keys(d).reduce((s, k) =>
        s.add(k), S), new Set(baseColumnHeaders));
    featureKeyArray = Array.from(featureKeySet),
    columnHeaders = columnHeadersMap ? featureKeyArray.map(columnHeadersMap) :
      featureKeyArray.slice();
  } else {
    featureKeyArray = baseColumnHeaders;
    columnHeaders = baseColumnHeaders;
  }

  exportAsCSVFile(fileName, data, featureKeyArray, columnHeaders, quoteIfNeeded);

}

//------------------------------------------------------------------------------
