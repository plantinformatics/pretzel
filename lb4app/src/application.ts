import path from 'path';

import {BootMixin} from '@loopback/boot';
import {ApplicationConfig, Constructor} from '@loopback/core';
import {
  RestExplorerBindings,
  RestExplorerComponent,
} from '@loopback/rest-explorer';
import {RepositoryMixin} from '@loopback/repository';
import {RestApplication} from '@loopback/rest';
import {Middleware} from '@loopback/express';
import {ServiceMixin} from '@loopback/service-proxy';

import {AuthenticationComponent, UserService} from '@loopback/authentication';
import {
  JWTAuthenticationComponent,
  RefreshTokenServiceBindings,
  SECURITY_SCHEME_SPEC,
  UserServiceBindings,
} from '@loopback/authentication-jwt';
import {Credentials} from '@loopback/authentication-jwt'; // /services/user.service

//------------------------------------------------------------------------------

import {MySequence} from './sequence';
import {EmailService} from './services/email.service';
import {initLb3Environment, initLb3ExceptionHandling, initLb3FrontendEnvironment} from './lb3-compat/boot';
import {lb3RouteTimeMiddleware} from './middleware/lb3-route-time.middleware';
import {lb3MemcacheMiddleware} from './middleware/lb3-memcache.middleware';
import {registerDatasetUploadFileBodyParser} from './middleware/dataset-upload-file-body-parser';
import {clientGroups} from './utils/client-groups';
import {Lb3ModelWrapProvider} from './utils/lb3-model-wrap.provider';
import {MongoDsDataSource} from './datasources';
import {ClientRepository} from './repositories';
import {ClientUserService} from './services/client-user.service';
import {User} from '@loopback/authentication-jwt';	// ./models

const {serverShowEnvironment, appServerLb3Setup, appServerLb3Setup2} = require('../lb3app/server/server');

//------------------------------------------------------------------------------

/* global process */

export {ApplicationConfig};

export class PretzelApplication extends BootMixin(
  ServiceMixin(RepositoryMixin(RestApplication)),
) {
  constructor(options: ApplicationConfig = {}) {
    super(options);

    // From @loopback/authentication-jwt/README.md
    // - enable jwt auth -
    // Mount authentication system
    this.component(AuthenticationComponent);
    // Mount jwt component
    this.component(JWTAuthenticationComponent);
    /* These bindings override the defaults in JWTAuthenticationComponent which
     * is instantiated above.
     * ClientUserService is based on (the default) MyUserService, and has the
     * same properties.  The need for customisation is simply that it uses a
     * different repository: clientRepository instead of userRepository.
     * Use ClientRepository for auth service lookups (Clients collection).
     */
    this.bind(UserServiceBindings.USER_SERVICE).toClass(
      ClientUserService as unknown as Constructor<UserService<User, Credentials> & object>,
    );

    /* Override default repository binding
     * This configures the parameter userRepository passed to the constructor of
     * MyUserService (@loopback/authentication-jwt/src/services/user.service.ts).
     *
     * That class is created by the IoC container when
     * UserServiceBindings.USER_SERVICE is injected (in ClientController).
     * The default binding comes from the authentication‑jwt component.
     */
    this.bind(UserServiceBindings.USER_REPOSITORY).toClass(ClientRepository);

    // LB3 environment validation (lb3app/server/environment.js)
    initLb3Environment();

    const app = this.requestHandler;
    serverShowEnvironment(app);
    appServerLb3Setup(app);
    appServerLb3Setup2(app);

    // Set up the custom sequence
    this.sequence(MySequence);
    registerDatasetUploadFileBodyParser(this);
    const routeTime = lb3RouteTimeMiddleware();
    const memcache = lb3MemcacheMiddleware(3600);
    this.middleware(({request, response}, next) => {
      /** lb3app/server/middleware.json did not restrict middleware/route_time
       * by endpoint path.
       */
      return routeTime(request, response, next);
      // return next();
    });
    this.middleware(({request, response}, next) => {
      /** lb3app/server/middleware.json enabled middleware/memcache for just
       * /api/Blocks/pathsViaStream
       */
      let useCache = false;
      const
      /** matches e.g. /api/Blocks/pathsViaStream */
      isBlocks = request.path?.startsWith('/Blocks'),
      isBlocksPath = request.path?.startsWith('/Blocks/paths');
      if (isBlocks) {
        const
        // older : request.params('intervals')
        intervals = isBlocksPath && request.query.intervals as any,
        zoomed = intervals ?
          // e.g. pathsViaStream
          // could test simply  == 'true'
          intervals.axes.find((axis : any) => axis.zoomed && JSON.parse(axis.zoomed)) :
          // e.g. blockFeaturesCounts
          request.query.isZoomed;
        if (! zoomed) {
          useCache = true;
        }
      }
      if (useCache) {
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
    this.bind('services.Email').toClass(EmailService);
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
