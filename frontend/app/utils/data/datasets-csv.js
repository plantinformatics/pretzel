import { fileDownloadAsCSV } from '../dom/file-download';

export {datasetsReport}

/** Generate a CSV / TSV report of the datasets visible to this user, and
 * export as a file download.
 */
function datasetsReport(datasets, store) {
  const
  fnName = 'datasetsReport',
  columnHeaders = [
    'id', 'displayName', 'shortName', 'type', 'Crop',
    'Category', 'Categories',
    'tags',
    'Owner',
    'Group',
  ],
  datasetStrings = datasets
    .map(d =>
      [
        d.id, d._meta?.displayName, d._meta?.shortName, d._meta?.type, d._meta?.Crop,
        d._meta?.Category, d._meta?.Categories?.join('_'),
        d.tags?.join('_'),
        clientIdToEmail(d.clientId, store) || d.clientId,
        d.get('groupId.name'),
      ]
        .map(string => string ?? '')
        .join(',')
    ),
  csv = [columnHeaders.join(',')].concat(datasetStrings)
    .join('\n');

  fileDownloadAsCSV('datasets.csv', csv);
}

export {clientIdToEmail}
/** Lookup email of clientId if it is loaded in the store
 */
function clientIdToEmail(clientId, store) {
  const
  client = store.peekRecord('client', clientId),
  email = client?.email;
  return email;
}
