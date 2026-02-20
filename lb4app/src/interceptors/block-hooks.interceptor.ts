import {inject, Provider, ValueOrPromise} from '@loopback/core';
import {InvocationContext, Interceptor, InvocationResult} from '@loopback/context';
import {repository} from '@loopback/repository';
import {BlockRepository, FeatureRepository, AnnotationRepository, IntervalRepository} from '../repositories';

// LB3 utilities reused to keep behavior consistent during migration.
// @ts-ignore
const {ArgsDebounce} = require('../../lb3app/common/utilities/debounce-args');
// @ts-ignore
const blockFeatures = require('../../lb3app/common/utilities/block-features');
// @ts-ignore
const cache = require('../../lb3app/common/utilities/results-cache');

export class BlockHooksInterceptor implements Provider<Interceptor> {
  private argsDebounce = new ArgsDebounce();

  constructor(
    @repository(BlockRepository) private blockRepository: BlockRepository,
    @repository(FeatureRepository) private featureRepository: FeatureRepository,
    @repository(AnnotationRepository) private annotationRepository: AnnotationRepository,
    @repository(IntervalRepository) private intervalRepository: IntervalRepository,
  ) {}

  value(): Interceptor {
    return this.intercept.bind(this);
  }

  async intercept(invocationCtx: InvocationContext, next: () => ValueOrPromise<InvocationResult>) {
    const methodName = invocationCtx.methodName;
    const args = invocationCtx.args;

    if (methodName === 'create' || methodName === 'save' || methodName === 'replaceById') {
      this.applyNameDefaults(args[0]);
    }
    if (methodName === 'updateById') {
      this.applyNameDefaults(args[1]);
    }

    if (methodName === 'deleteById') {
      await this.beforeDelete(args[0]);
    } else if (methodName === 'deleteAll') {
      await this.beforeDeleteAll(args[0]);
    }

    const result = await next();

    if (methodName === 'create') {
      const blockId = (result as any)?.id ?? (args[0] as any)?.id;
      if (blockId) this.afterSave(blockId.toString());
    } else if (methodName === 'updateById' || methodName === 'replaceById') {
      const blockId = args[0];
      if (blockId) this.afterSave(blockId.toString());
    }

    return result;
  }

  private applyNameDefaults(instance: any) {
    if (!instance || typeof instance !== 'object') return;
    if (!instance.name) {
      if (instance.scope) {
        instance.name = instance.scope;
      } else if (instance.namespace) {
        instance.name = instance.namespace;
      }
    }
  }

  private async beforeDelete(blockId: unknown) {
    if (blockId == null) return;
    const id = String(blockId);
    await this.featureRepository.deleteAll({blockId: id});
    const annotations = await this.annotationRepository.find({where: {blockId: id}});
    await Promise.all(annotations.map(a => this.annotationRepository.deleteById(a.id)));
    const intervals = await this.intervalRepository.find({where: {blockId: id}});
    await Promise.all(intervals.map(i => this.intervalRepository.deleteById(i.id)));
  }

  private async beforeDeleteAll(where?: {id?: unknown}) {
    const id = (where as any)?.id;
    if (!id) return;
    if (Array.isArray(id?.inq)) {
      await Promise.all(id.inq.map((blockId: unknown) => this.beforeDelete(blockId)));
    } else {
      await this.beforeDelete(id);
    }
  }

  private afterSave(blockId: string) {
    this.argsDebounce.debounced(this.blockAfterSave.bind(this), blockId, 1000)();
  }

  private blockAfterSave(blockId: string) {
    const apiName = 'blockFeaturesInterval';
    const cacheId = `${apiName}_${blockId}`;
    const value = cache.get(cacheId);
    if (value) {
      // eslint-disable-next-line no-console
      console.log(apiName, 'remove from cache', cacheId, value.length || value);
      cache.put(cacheId, undefined);
    }
    blockFeatures.blockFeaturesCacheClear(cache);
  }
}
