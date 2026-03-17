import {
  repository,
} from '@loopback/repository';
import {
  param,
  get,
  getModelSchemaRef,
  HttpErrors,
} from '@loopback/rest';
import {
  Annotation,
  Block,
} from '../models';
import {AnnotationRepository} from '../repositories';

export class AnnotationBlockController {
  constructor(
    @repository(AnnotationRepository)
    public annotationRepository: AnnotationRepository,
  ) { }

  @get('/annotations/{id}/block', {
    responses: {
      '200': {
        description: 'Block belonging to Annotation',
        content: {
          'application/json': {
            schema: getModelSchemaRef(Block),
          },
        },
      },
    },
  })
  async getBlock(
    @param.path.string('id') id: typeof Annotation.prototype.id,
  ): Promise<Block> {
    throw new HttpErrors.NotFound('Endpoint disabled');
    // implementation is disabled by throw :
    // return this.annotationRepository.block(id);
  }
}
