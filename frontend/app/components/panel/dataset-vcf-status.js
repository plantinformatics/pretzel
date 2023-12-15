import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { computed, action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import { statusToMatrix, vcfPipeline } from '../../utils/data/vcf-files';

const dLog = console.debug;

export default class PanelDatasetVCFStatusComponent extends Component {
  @service() auth;

  @tracked showDetail = false;

  @tracked vcfStatus;
  @action
  getVcfStatus() {
    const id = this.args.dataset.id;
    this.auth.getFeaturesCountsStatus(id, /*options*/undefined)
      .then(vcfStatus => this.vcfStatus = statusToMatrix(vcfStatus?.text));
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
