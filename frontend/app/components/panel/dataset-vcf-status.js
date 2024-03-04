import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { computed, action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import { statusToMatrix, vcfPipeline } from '../../utils/data/vcf-files';
import { getDatasetFeaturesCounts } from '../../utils/data/vcf-feature';

const dLog = console.debug;

export default class PanelDatasetVCFStatusComponent extends Component {
  @service() auth;
  @service() controls;

  @tracked showDetail = false;

  /** [datasetId] -> status matrix : [chr] -> cols */
  vcfStatuses = {};
  @tracked
  vcfStatusesUpdateCount = 0;
  @tracked
  histogramStatusChangeCount = 0;
  @computed('vcfStatuses', 'vcfStatusesUpdateCount', 'args.dataset.id')
  get vcfStatus() {
    const status = this.vcfStatuses[this.args.dataset.id];
    return status;
  }
  @action
  getVcfStatus() {
    const id = this.args.dataset.id;
    this.auth.getFeaturesCountsStatus(id, /*options*/undefined)
      .then(vcfStatus => {

        this.vcfStatuses[id] = statusToMatrix(vcfStatus?.text);
        this.vcfStatusesUpdateCount++;
      });
  }
  @action
  getDatasetFeaturesCounts() {
    const
    fnName = 'getDatasetFeaturesCounts',
    dataset = this.args.dataset,
    datasetId = dataset.id,
    statusP = getDatasetFeaturesCounts(this.auth, datasetId, this.controls.genotypeSNPFilters);
    statusP
      .then(datasetSum => {
        dLog(fnName, 'datasetSum', datasetSum, dataset.featureCount);
        dataset.set('featureCount', datasetSum);
        const byBlockIdP = this.controls.apiServerSelectedOrPrimary.blocksFeaturesCountsStatus;
        byBlockIdP.then(x => {
          this.histogramStatusChangeCount++;
        });
      });
  }

  @computed('args.dataset')
  get blockNames() {
    return this.args.dataset.blocks.mapBy('name');
  }
  @computed('args.dataset')
  get blocksByName() {
    const
    byName = this.args.dataset.blocks.reduce((map, block) => {
      map[block.name] = block;
      return map;
    }, {});
    return byName;
  }
  /** Augment .vcfStatus.rows with .blockNames, so that the result contains
   * firstly a row for each of the .blockNames, and then the remainder of
   * .vcfStatus.rows, i.e. the rows whose .Name is not in .blockNames.
   *
   * This is displayed in the table; it ensures that there is a row for each
   * block of .dataset, and then rows for other VCFs which do not correspond to
   * names of blocks of .dataset
   */
  @computed('blockNames', 'vcfStatus')
  get rowsCombined() {
    let combined;
    if (this.vcfStatus) {
      const
      rowsByName = this.vcfStatus.rows.reduce((byName, row) => {
	byName[row.Name] = row;
	return byName;
      }, {}),
      blockRows = this.blockNames.map(name => {
	const r = rowsByName[name] || {Name : name};
	return r;
      }),
      nonBlockRows = this.vcfStatus.rows.filter(row => ! this.blockNames.includes(row.Name));
      combined = blockRows.concat(nonBlockRows);
    }
    return combined;
  }


  @action
  cellIcon(row, columnName) {
    const
    fnName = 'cellIcon',
    value = row[columnName],
    icon = value ? 'ok' : '';
    // dLog(fnName, icon, value, row, columnName);
    return icon;
  }
  
  /** @return 'chrNotInDataset' if the given chromosome name is not in @dataset block names.
   * @param chrName chromosome name from .vcf.gz file name.
   */
  @action
  chrNotInDataset(chrName) {
    const
    names = this.blockNames,
    className = names.includes(chrName) ? '' : 'chrNotInDataset';
    return className;
  }
  @action
  suffixNotInPipeline(suffix) {
    const
    className = vcfPipeline.indexOf(suffix) === -1 ? 'notInPipeline' : '';
    return className;
  }

  @action
  chrStatus(chrName) {
    const
    block = this.blocksByName[chrName],
    status = block ? block.featuresCountsStatus : '';
    return status;
  }
  @action
  chrStatusClass(chrName) {
    let classNames = '';
    if (! this.showDetail) {
      const
      status = this.chrStatus(chrName),
      ok = !!status;
      classNames = ok ? this.iconClass('ok') : '';
    }
    return classNames;
  }

  @action
  /** Construct class names to select glyphicon glyphs.
   * @return undefined if name is undefined.
   * @desc Based on components/elem/icon-base.js : iconClass()
   */
  iconClass(name) {
    return name && 'glyphicon glyphicon-' + name;
  }

}
