import {BootMixin} from '@loopback/boot';
import {ApplicationConfig} from '@loopback/core';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {Middleware} from '@loopback/express';
import {ServiceMixin} from '@loopback/service-proxy';

import path from 'path';
import {MySequence} from './sequence';
import {initLb3Environment, initLb3ExceptionHandling, initLb3FrontendEnvironment} from './lb3-compat/boot';
import {lb3RouteTimeMiddleware} from './middleware/lb3-route-time.middleware';
import {lb3MemcacheMiddleware} from './middleware/lb3-memcache.middleware';
import {registerDatasetUploadFileBodyParser} from './middleware/dataset-upload-file-body-parser';
import {clientGroups} from './utils/client-groups';
import {Lb3ModelWrapProvider} from './utils/lb3-model-wrap.provider';
import {MongoDsDataSource} from './datasources';

const {serverShowEnvironment, appServerLb3Setup, appServerLb3Setup2} = require('../lb3app/server/server');

/* global process */

export {ApplicationConfig};

export class PretzelApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // LB3 environment validation (lb3app/server/environment.js)
    initLb3Environment();

    const app = this.requestHandler;
    serverShowEnvironment(app);
    appServerLb3Setup(app);
    appServerLb3Setup2(app);

    // Set up the custom sequence
    this.sequence(MySequence);
    registerDatasetUploadFileBodyParser(this);
    const blocksPathPrefix = '/Blocks';
    const routeTime = lb3RouteTimeMiddleware();
    const memcache = lb3MemcacheMiddleware(3600);
    this.middleware(({request, response}, next) => {
      if (request.path?.startsWith(blocksPathPrefix)) {
        return routeTime(request, response, next);
      }
      return next();
    });
    this.middleware(({request, response}, next) => {
      if (request.path?.startsWith(blocksPathPrefix)) {
        return memcache(request, response, next);
      }
      return next();
    });

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
    // LB3 exception handling and frontend environment setup
    initLb3ExceptionHandling(this);
    if (process.env.API4_STATIC) {
      initLb3FrontendEnvironment(this);
    }

    this.on('started', async () => {
      try {
        const ds = await this.get('datasources.mongoDs') as MongoDsDataSource;
        clientGroups.init(ds);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('clientGroups init failed', err);
      }
    });
    this.bind('utils.Lb3ModelWrap').toProvider(Lb3ModelWrapProvider);
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
  }
}
