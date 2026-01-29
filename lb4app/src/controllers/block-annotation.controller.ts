import {
  Count,
  CountSchema,
  Filter,
  repository,
  Where,
} from '@loopback/repository';
import {
  del,
  get,
  getModelSchemaRef,
  getWhereSchemaFor,
  param,
  patch,
  post,
  requestBody,
} from '@loopback/rest';
import {
  Block,
  Annotation,
} from '../models';
import {BlockRepository} from '../repositories';

export class BlockAnnotationController {
  constructor(
    @repository(BlockRepository) protected blockRepository: BlockRepository,
  ) { }

  @get('/blocks/{id}/annotations', {
    responses: {
      '200': {
        description: 'Array of Block has many Annotation',
        content: {
          'application/json': {
            schema: {type: 'array', items: getModelSchemaRef(Annotation)},
          },
        },
      },
    },
  })
  async find(
    @param.path.string('id') id: string,
    @param.query.object('filter') filter?: Filter<Annotation>,
  ): Promise<Annotation[]> {
    return this.blockRepository.annotations(id).find(filter);
  }

  @post('/blocks/{id}/annotations', {
    responses: {
      '200': {
        description: 'Block model instance',
        content: {'application/json': {schema: getModelSchemaRef(Annotation)}},
      },
    },
  })
  async create(
    @param.path.string('id') id: typeof Block.prototype.id,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Annotation, {
            title: 'NewAnnotationInBlock',
            exclude: ['id'],
            optional: ['blockId']
          }),
        },
      },
    }) annotation: Omit<Annotation, 'id'>,
  ): Promise<Annotation> {
    return this.blockRepository.annotations(id).create(annotation);
  }

  @patch('/blocks/{id}/annotations', {
    responses: {
      '200': {
        description: 'Block.Annotation PATCH success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async patch(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Annotation, {partial: true}),
        },
      },
    })
    annotation: Partial<Annotation>,
    @param.query.object('where', getWhereSchemaFor(Annotation)) where?: Where<Annotation>,
  ): Promise<Count> {
    return this.blockRepository.annotations(id).patch(annotation, where);
  }

  @del('/blocks/{id}/annotations', {
    responses: {
      '200': {
        description: 'Block.Annotation DELETE success count',
        content: {'application/json': {schema: CountSchema}},
      },
    },
  })
  async delete(
    @param.path.string('id') id: string,
    @param.query.object('where', getWhereSchemaFor(Annotation)) where?: Where<Annotation>,
  ): Promise<Count> {
    return this.blockRepository.annotations(id).delete(where);
  }
}
