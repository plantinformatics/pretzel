import {Provider, inject} from '@loopback/core';
import {RequestContext, RestBindings} from '@loopback/rest';
import {MongoDsDataSource} from '../datasources';
import {
  BlockRepository,
  ClientRepository,
  FeatureRepository,
  ClientGroupRepository,
  DatasetRepository,
  GroupRepository,
  AliasRepository,
  AnnotationRepository,
  IntervalRepository,
} from '../repositories';
import {Lb3ModelWrap} from './lb3-model-wrap';

type Lb3Module = (modelClass: any) => void;
export type Lb3ModelWrapFactory = (lb3Module: Lb3Module, appModels?: Record<string, unknown>) => Lb3ModelWrap;

/** Wrap a bundle of repositories used by lb4app/lb3app/common/models/
 *
  Injects all required repositories + context/datasource
  Returns a factory function: (lb3Module, appModels?) => Lb3ModelWrap
  Builds a default appModels map using injected repos (Block, Client, Group, Feature, Dataset, Alias, ClientGroup, Annotation, Interval)
 */
export class Lb3ModelWrapProvider implements Provider<Lb3ModelWrapFactory> {
  constructor(
    @inject(RestBindings.Http.CONTEXT) private ctx: RequestContext,
    @inject('datasources.mongoDs') private mongoDs: MongoDsDataSource,
    @inject('repositories.BlockRepository') private blockRepository: BlockRepository,
    @inject('repositories.ClientRepository') private clientRepository: ClientRepository,
    @inject('repositories.FeatureRepository') private featureRepository: FeatureRepository,
    @inject('repositories.DatasetRepository') private datasetRepository: DatasetRepository,
    @inject('repositories.AliasRepository') private aliasRepository: AliasRepository,
    @inject('repositories.AnnotationRepository') private annotationRepository: AnnotationRepository,
    @inject('repositories.IntervalRepository') private intervalRepository: IntervalRepository,
    @inject('repositories.ClientGroupRepository') private clientGroupRepository: ClientGroupRepository,
    @inject('repositories.GroupRepository') private groupRepository: GroupRepository,
  ) {}

  value(): Lb3ModelWrapFactory {
    return (lb3Module: Lb3Module, appModels?: Record<string, unknown>) => {
      const defaultModels: Record<string, unknown> = {
        Block: this.blockRepository,
        Client: this.clientRepository,
        Group: this.groupRepository,
        Feature: this.featureRepository,
        Dataset: this.datasetRepository,
        Alias: this.aliasRepository,
        ClientGroup: this.clientGroupRepository,
        Annotation: this.annotationRepository,
        Interval: this.intervalRepository,
      };
      return new Lb3ModelWrap({
        lb3Module,
        appModels: appModels ?? defaultModels,
        ctx: this.ctx,
        mongoDs: this.mongoDs,
        blockRepository: this.blockRepository,
        datasetRepository: this.datasetRepository,
        clientGroupRepository: this.clientGroupRepository,
        groupRepository: this.groupRepository,
      });
    };
  }
}
