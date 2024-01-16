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
    datasetId = this.args.dataset.id,
    statusP = getDatasetFeaturesCounts(this.auth, datasetId, this.controls.genotypeSNPFilters);
    statusP
      .then(status => {
        dLog(fnName, status);
        /*
        const byBlockIdP = this.apiServerSelectedOrPrimary.blocksFeaturesCountsStatus;
        // this.getVcfStatus() : .then(vcfStatus ... )
        */
      });
  }

  @computed('args.dataset')
  get blockScopes() {
    return this.args.dataset.blocks.mapBy('scope');
  }
  @computed('args.dataset')
  get blocksByScope() {
    const
    byScope = this.args.dataset.blocks.reduce((map, block) => {
      map[block.scope] = block;
      return map;
    }, {});
    return byScope;
  }
  /** Augment .vcfStatus.rows with .blockScopes, so that the result contains
   * firstly a row for each of the .blockScopes, and then the remainder of
   * .vcfStatus.rows, i.e. the rows whose .Name is not in .blockScopes.
   *
   * This is displayed in the table; it ensures that there is a row for each
   * block of .dataset, and then rows for other VCFs which do not correspond to
   * scopes of blocks of .dataset
   */
  @computed('blockScopes', 'vcfStatus')
  get rowsCombined() {
    let combined;
    if (this.vcfStatus) {
      const
      rowsByName = this.vcfStatus.rows.reduce((byName, row) => {
	byName[row.Name] = row;
	return byName;
      }, {}),
      blockRows = this.blockScopes.map(scope => {
	const r = rowsByName[scope] || {Name : scope};
	return r;
      }),
      nonBlockRows = this.vcfStatus.rows.filter(row => ! this.blockScopes.includes(row.Name));
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
  
  /** @return 'chrNotInDataset' if the given chromosome name is not in @dataset block scopes.
   * @param chrName chromosome name from .vcf.gz file name.
   */
  @action
  chrNotInDataset(chrName) {
    const
    scopes = this.blockScopes,
    className = scopes.includes(chrName) ? '' : 'chrNotInDataset';
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
    block = this.blocksByScope[chrName],
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
