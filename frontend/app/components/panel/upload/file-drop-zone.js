import { inject as service } from '@ember/service';
import { alias } from '@ember/object/computed';
import { later } from '@ember/runloop';
import { on } from '@ember/object/evented';

import { statusToMatrix } from '../../../utils/data/vcf-files';

const dLog = console.debug;

import UploadBase from './data-base';

//------------------------------------------------------------------------------

/** used as a truthy filter */
function I(value) { return value; }

/** utils/data/vcf-files.js :  statusToMatrix() maps '.' to unicodeDot */
const unicodeDot = '·';

const allowedFileTypes = [
  // 'image/gif', 'image/jpeg', 'image/png', 'image/webp',	// devel / testing
  'application/json',
  'application/vnd.google-apps.spreadsheet',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/gzip',
  'application/zip',
  'text/gff3',
];


/*----------------------------------------------------------------------------*/

/** Convert ArrayBuffer to String, using single-char operations.
 */
function arrayBufferToString1Char(buffer) {
  /* Based on https://stackoverflow.com/a/60782610 Anthony O.
   * Similar using reduce() : https://stackoverflow.com/a/60301316
   */
  let binary = '';
  let bytes = new Uint8Array(buffer);
  let len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}


/** Convert ArrayBuffer to String, using 2^16 Byte chunks.
 * from : https://stackoverflow.com/a/20604561 Ryan Weinstein
 * "... about 20 times faster than using blob. It also works for large strings of over 100mb."
 */
function arrayBufferToString(buffer){
  var bufView = new Uint8Array(buffer);
  var length = bufView.length;
  var result = '';
  var addition = Math.pow(2,16)-1;

  for (var i = 0; i < length; i += addition) {
    if (i + addition > length) {
      addition = length - i;
    }
    result += String.fromCharCode.apply(null, bufView.subarray(i, i + addition));
  }

  return result;
}


/*----------------------------------------------------------------------------*/


export default UploadBase.extend({
  apiServers : service(),
  blockService : service('data/block'),
  controls : service(),

  apiServerSelectedOrPrimary : alias('controls.apiServerSelectedOrPrimary'),

  replaceDataset : true,

  //----------------------------------------------------------------------------

  didInsertElement: on('didInsertElement', function() {
    if (window.PretzelFrontend) {
      window.PretzelFrontend.fileDropZone = this;
    }
  }),

  //----------------------------------------------------------------------------

  // @action
  validateFile(file) {
    dLog('validateFile', file.type, file.name, file.size, file, 'onDrag');
    let ok = allowedFileTypes.includes(file.type);
    if (! ok) {
      ok = file.type.match(/\.json$|\.gz$|\.xlsx$|\.xls$|\.ods$/);
    }
    this.recentFileType = file.type;
    return ok;
  },

  //----------------------------------------------------------------------------

  typesText : null,
  // @action
  /** required to make .files available in onDrop().
   * by https://developer.mozilla.org/en-US/docs/Web/Guide/HTML/Drag_operations */
  onDragEnter(files, dataTransferWrapper) {
    const dt = dataTransferWrapper?.dataTransfer;
    dLog('onDragEnter', files, dataTransferWrapper, dataTransferWrapper.itemDetails, dt?.types);
    this.showTypes(files, dataTransferWrapper);
    this.warningMessage = null;
  },
  showTypes(okFiles, dataTransferWrapper) {
    const fnName = 'showTypes';
    const dt = dataTransferWrapper.dataTransfer;
    if (dt) {
    // this.typesText = '[ ' + .join(', ') + ' ]';
      const
      filesText =
        okFiles.length ? okFiles.mapBy('name') :
        dt.files.length ? Array.from(dt.files).mapBy('name') :
        dataTransferWrapper.itemDetails.length ? dataTransferWrapper.itemDetails.map(id => Object.values(id).join(':')) :
        dt.types;
      const
      text = '[ ' + filesText.join(', ') + ' ]',
      /* validateFile() is not done until drop : file-dropzone.js : addFiles() : .args.filter( )
       * so including .recentFileType is not useful - the value lags.
       * (this.recentFileType??'') +
       */
      typesText = (okFiles.length || dataTransferWrapper.itemDetails.length) + ' ' + text;
      this.set('typesText', typesText);
      dLog(fnName, this.typesText, 'onDrag');
    }
  },
  // @action
  onDragLeave(files, dataTransferWrapper) {
    dLog('onDragLeave', files, dataTransferWrapper, dataTransferWrapper.itemDetails);
    this.typesText = null;
    this.recentFileType = null;
  },
  // @action
  onDrop(addedFiles, dataTransfer) {
    const dt = dataTransfer.dataTransfer;
    dLog('onDrop', addedFiles, dataTransfer, dataTransfer.itemDetails, dt.items, dt.files, dt.types);
    // this.showTypes(addedFiles, dataTransfer);
    if (! addedFiles.length && dataTransfer.itemDetails.length) {
      this.warningMessage = 
        'Not accepted :' + dataTransfer.itemDetails.map(id => Object.values(id).join(':'));
    }
    // later(() => {this.typesText = null; this.recentFileType = null;} , 1000);
  },

  /** @action */
  uploadSpreadsheet(file) {
    const
    fnName = 'uploadSpreadsheet',
    // blob = file.blob,
    queue = file.queue;
    dLog(
      fnName, file.name,
      file.size,
      file.type,
      file.source,
      // blob.lastModifiedDate,
      file.file.lastModified,
      new Date(file.file.lastModified),
      queue
    );

    this.setProcessing();
    this.scrollToTop();

    /** previous : var bufferPromise = file.blob.arrayBuffer(); */
    file.readAsArrayBuffer().then((buffer) => {
      /* process the ArrayBuffer */
      dLog(fnName, 'arrayBuffer', buffer, buffer.byteLength);
      const
      fileName = file.name,
      data = arrayBufferToString(buffer),
      replaceDataset = this.replaceDataset,
      /** corresponds to the param msg in backend/common/models/dataset.js : upload(). */
      message = {fileName, data, replaceDataset};
      this.set('warnings', []);
      this.set('errors', []);
      /** a jQuery promise (jqXHR) */
      let promise =
      this.uploadData(message);
      // .uploadData() .then( , onRejected) does .setError()
      promise.always(() => file.queue.remove(file));
      /** data-base:uploadData() calls setSuccess() (i.e. 'Uploaded successfully')
       * Prepend the datasetName to that message.
       */
      promise.then((res) => {
        const status = res.status;
        let datasetNames;
        if (status.datasetNames) {
          datasetNames = status.datasetNames;
        } else {
          datasetNames = [status];
        }
        datasetNames.forEach((datasetName) => this.unviewDataset(datasetName));
        if (datasetNames.length) {
          this.setSuccess("Dataset '" + datasetNames.join("', '") + "' " +  this.successMessage);
        } else if (status.errors?.length) {
          // displays 'Error' if message is non-empty
          this.setError(' ');
        } else if (status.warnings?.length) {
          this.setWarning(' ');
        }
        const
        datasetWarnings  = status.datasetsWithErrorsOrWarnings?.map(
          (d) => [d.name].concat(d.errors || []).concat(d.warnings || [])) || [],
        warnings = status?.warnings.concat(datasetWarnings.flat());
        this.set('warnings', warnings);
        this.set('errors', status?.errors || []);
        this.get('blockService').featureSaved();

        this.vcfWarnings(datasetNames);
      });
    });

  },

  /** Unview the blocks of the dataset which has been replaced by successful upload.
   */
  unviewDataset(datasetName) {
    const
    store = this.get('apiServerSelectedOrPrimary').get('store'),
    replacedDataset = store.peekRecord('dataset', datasetName);
    if (replacedDataset) {
      let
      viewedBlocks = replacedDataset.get('blocks').toArray().filterBy('isViewed'),
      blockService = this.get('blockService'),
      blockIds = viewedBlocks.map((b) => b.id);
      dLog('unviewDataset', datasetName, blockIds);
      blockService.setViewed(blockIds, false);
    }
  },

  vcfWarnings(datasetNames) {
    const
    store = this.get('apiServerSelectedOrPrimary').get('store'),
    warningsAP = datasetNames
      .map(datasetName => {
        const dataset = store.peekRecord('dataset', datasetName);
        return dataset?.isVCF && dataset;
      })
      .filter(I)
      .map(dataset => {
        const
        warningP =
          this.get('auth').getFeaturesCountsStatus(dataset.id, /*options*/undefined)
          .then(vcfStatus => {
            const
            status = statusToMatrix(vcfStatus?.text),
            /** warnings for this dataset : chromosomes which don't have .MAF.SNPList.vcf.gz */
            scopes = dataset.blocks.mapBy('scope'),
            dwc = scopes.filter(scope => {
              const chr = status.rows.findBy('Name', scope);
              // note : . is unicodeDot here.  see statusToMatrix().
              return ! chr?.['·MAF·SNPList'];
            });
            return dwc.length && (dataset.id + ' : ' + dwc.join(' '));
          });
        return warningP;
      });

    Promise.all(warningsAP).then(warnings => {
      warnings = warnings.filter(I);
      if (warnings.length) {
        const intro = "Chromosomes of these datasets don't have .MAF.SNPList.vcf.gz :";
        this.warnings.pushObjects([intro].concat(warnings));
      }
    });
  },

});
