import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
} from '@loopback/rest';
import {
  Annotation,
  Feature,
} from '../models';
import {AnnotationRepository} from '../repositories';

export class AnnotationFeatureController {
  constructor(
    @repository(AnnotationRepository)
    public annotationRepository: AnnotationRepository,
  ) { }

  @get('/annotations/{id}/feature', {
    responses: {
      '200': {
        description: 'Feature belonging to Annotation',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Feature),
          },
        },
      },
    },
  })
  async getFeature(
    @param.path.string('id') id: typeof Annotation.prototype.id,
  ): Promise<Feature> {
    return this.annotationRepository.feature(id);
  }
}
