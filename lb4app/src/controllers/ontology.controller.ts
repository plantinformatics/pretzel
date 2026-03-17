import {inject} from '@loopback/core';
import {get, param} from '@loopback/rest';
import {Lb3ModelWrap} from '../utils/lb3-model-wrap';
import {Lb3ModelWrapFactory} from '../utils/lb3-model-wrap.provider';

// @ts-ignore
const OntologyModule = require('../../lb3app/common/models/ontology');

export class OntologyController {
  private lb3: Lb3ModelWrap;

  constructor(
    @inject('utils.Lb3ModelWrap') private lb3WrapFactory: Lb3ModelWrapFactory,
  ) {}

  @get('/Ontologies/getTree', {
    responses: {
      '200': {
        description: 'Request ontology tree of Ontology API source',
        content: {
          'application/json': {
            schema: {type: 'array', items: {type: 'object'}},
          },
        },
      },
    },
  })
  async getTree(
    @param.query.string('rootId', {required: true}) rootId: string,
  ): Promise<object[]> {
    await this.requireAuth();
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.getTree(rootId, cb);
    });
  }

  private ensureLb3() {
    if (!this.lb3) {
      this.lb3 = this.lb3WrapFactory(OntologyModule);
    }
  }

  private async requireAuth(): Promise<void> {
    this.ensureLb3();
    await this.lb3.authUtils.requireClientId();
  }
}
