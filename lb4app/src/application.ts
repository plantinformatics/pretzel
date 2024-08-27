import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {ServiceMixin} from '@loopback/service-proxy';
import {Lb3AppBooterComponent} from '@loopback/booter-lb3app';

import path from 'path';
import {MySequence} from './sequence';
import {DatasetRepository} from './repositories';
import {DatasetController} from './controllers';

/* global process */

export {ApplicationConfig};

export class PretzelApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // Set up the custom sequence
    this.sequence(MySequence);

    if (process.env.API4_STATIC) {
      // Set up default home page
      this.static('/', path.join(__dirname, '../public'));
    }

    if (process.env.API4_EXPLORER) {
      console.log('/explorer enabled by API4_EXPLORER');
    // Customize @loopback/rest-explorer configuration here
    this.configure(RestExplorerBindings.COMPONENT).to({
      path: '/explorer',
    });
    this.component(RestExplorerComponent);
    }

    this.projectRoot = __dirname;
    // Customize @loopback/boot Booter Conventions here
    this.bootOptions = {
      controllers: {
        // Customize ControllerBooter Conventions here
        // default : dirs: ['controllers']
        dirs: ['controllers'],
        extensions: ['.controller.js'],
        nested: true,
      },
      lb3app: {
        // server file is found under this path
        // path: '../../backend/server/server',
      },
    };
    this.component(Lb3AppBooterComponent);

    this.repository(DatasetRepository);
    this.controller(DatasetController);
  }
}
