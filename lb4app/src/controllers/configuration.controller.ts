import {get, response} from '@loopback/rest';
import {inject} from '@loopback/core';
import {Lb3ModelWrap} from '../utils/lb3-model-wrap';
import {Lb3ModelWrapFactory} from '../utils/lb3-model-wrap.provider';

// @ts-ignore
const ConfigurationModule = require('../../lb3app/common/models/configuration');

export class ConfigurationController {
  private lb3: Lb3ModelWrap;

  constructor(
    @inject('utils.Lb3ModelWrap') private lb3WrapFactory: Lb3ModelWrapFactory,
  ) {
    this.lb3 = this.lb3WrapFactory(ConfigurationModule);
  }

  @get('/Configurations/runtimeConfig', {
    responses: {
      '200': {
        description: 'Request run-time environment configuration of backend server.',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async runtimeConfig(): Promise<object> {
    await this.requireAuth();
    this.lb3.bindLb3DataSource();
    return this.lb3.lb3Call<object>(cb => {
      this.lb3.model.runtimeConfig(cb);
    });
  }

  @get('/Configurations/version')
  @response(200, {
    description: 'Request API version of backend server.',
    content: {'application/json': {schema: {type: 'object'}}},
  })
  async version(): Promise<object> {
    await this.requireAuth();
    this.lb3.bindLb3DataSource();
    return this.lb3.lb3Call<object>(cb => {
      this.lb3.model.version(cb);
    });
  }

  private async requireAuth(): Promise<void> {
    await this.lb3.authUtils.requireClientId();
  }
}
