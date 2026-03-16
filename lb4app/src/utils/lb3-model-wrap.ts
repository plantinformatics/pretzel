import {RequestContext} from '@loopback/rest';
import {MongoDsDataSource} from '../datasources';
import {AuthUtils} from './auth';
import {
  BlockRepository,
  ClientGroupRepository,
  DatasetRepository,
  GroupRepository,
} from '../repositories';

type Lb3Module = (modelClass: any) => void;

export class Lb3ModelClass {
  static remoteMethod() {}
  static observe(eventName: string, eventHandlerFunction: Function) {
    (this as any)[`observe_${eventName}`] = eventHandlerFunction;
  }
  static beforeRemote(methodName: string, eventHandlerFunction: Function) {
    (this as any)[`beforeRemote_${methodName}`] = eventHandlerFunction;
  }
  static afterRemote(methodName: string, eventHandlerFunction: Function) {
    (this as any)[`afterRemote_${methodName}`] = eventHandlerFunction;
  }
  static dataSource = {connector: null};
  static app: any = {};
}

export class Lb3ModelWrap {
  private mongoDs: MongoDsDataSource;
  public authUtils: AuthUtils;
  public model: any;

  constructor(options: {
    lb3Module: Lb3Module;
    appModels: Record<string, unknown>;
    ctx: RequestContext;
    mongoDs: MongoDsDataSource;
    blockRepository: BlockRepository;
    datasetRepository: DatasetRepository;
    clientGroupRepository: ClientGroupRepository;
    groupRepository: GroupRepository;
  }) {
    this.mongoDs = options.mongoDs;
    this.authUtils = new AuthUtils(
      options.ctx,
      options.mongoDs,
      options.blockRepository,
      options.datasetRepository,
      options.clientGroupRepository,
      options.groupRepository,
    );


    options.lb3Module(Lb3ModelClass);
    Lb3ModelClass.app.models = options.appModels;
    this.model = Lb3ModelClass;
  }

  bindLb3DataSource() {
    const connector = this.mongoDs.connector as any;
    this.model.dataSource.connector = connector.db ?? connector;
  }

  lb3Call<T>(invoke: (cb: (error: unknown, result: T) => void) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      function cb(error: unknown, result: T) {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
      invoke(cb);
    });
  }

  lb3CallNoCb<T>(invoke: () => Promise<T>): Promise<T> {
    return invoke();
  }
}
