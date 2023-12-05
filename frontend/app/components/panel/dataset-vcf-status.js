import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';

import { statusToMatrix } from '../../utils/data/vcf-files';

const dLog = console.debug;

export default class PanelDatasetVCFStatusComponent extends Component {
  @service() auth;

  @tracked vcfStatus;
  @action
  getVcfStatus() {
    const id = this.args.dataset.id;
    this.auth.getFeaturesCountsStatus(id, /*options*/undefined)
      .then(vcfStatus => this.vcfStatus = statusToMatrix(vcfStatus?.text));
  }


}
