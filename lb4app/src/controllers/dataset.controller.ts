import {
  Count,
  CountSchema,
  Filter,
  FilterExcludingWhere,
  repository,
  Where,
} from '@loopback/repository';
import {
  post,
  param,
  get,
  getModelSchemaRef,
  patch,
  put,
  del,
  requestBody,
  response,
  Request,
  Response,
  RestBindings,
  HttpErrors,
} from '@loopback/rest';
import {inject} from '@loopback/core';
import {Dataset} from '../models';
import {DatasetRepository} from '../repositories';
import {Lb3ModelWrap} from '../utils/lb3-model-wrap';
import {Lb3ModelWrapFactory} from '../utils/lb3-model-wrap.provider';

// @ts-ignore
const DatasetModule = require('../../lb3app/common/models/dataset');
// @ts-ignore
const {noCacheResult} = require('../../lb3app/common/utilities/remote-method');

export class DatasetController {
  private lb3: Lb3ModelWrap;

  constructor(
    @repository(DatasetRepository)
    public datasetRepository : DatasetRepository,
    @inject('utils.Lb3ModelWrap') private lb3WrapFactory: Lb3ModelWrapFactory,
  ) {}

  @post('/datasets')
  @response(200, {
    description: 'Dataset model instance',
    content: {'application/json': {schema: getModelSchemaRef(Dataset)}},
  })
  async create(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {
            title: 'NewDataset',
            
          }),
        },
      },
    })
    dataset: Dataset,
  ): Promise<Dataset> {
    return this.datasetRepository.create(dataset);
  }

  @get('/datasets/count')
  @response(200, {
    description: 'Dataset model count',
    content: {'application/json': {schema: CountSchema}},
  })
  async count(
    @param.where(Dataset) where?: Where<Dataset>,
  ): Promise<Count> {
    return this.datasetRepository.count(where);
  }

  @get('/datasets')
  @response(200, {
    description: 'Array of Dataset model instances',
    content: {
      'application/json': {
        schema: {
          type: 'array',
          items: getModelSchemaRef(Dataset, {includeRelations: true}),
        },
      },
    },
  })
  async find(
    @param.filter(Dataset) filter?: Filter<Dataset>,
  ): Promise<Dataset[]> {
    return this.datasetRepository.find(filter);
  }

  @patch('/datasets')
  @response(200, {
    description: 'Dataset PATCH success count',
    content: {'application/json': {schema: CountSchema}},
  })
  async updateAll(
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {partial: true}),
        },
      },
    })
    dataset: Dataset,
    @param.where(Dataset) where?: Where<Dataset>,
  ): Promise<Count> {
    return this.datasetRepository.updateAll(dataset, where);
  }

  @get('/datasets/{id}')
  @response(200, {
    description: 'Dataset model instance',
    content: {
      'application/json': {
        schema: getModelSchemaRef(Dataset, {includeRelations: true}),
      },
    },
  })
  async findById(
    @param.path.string('id') id: string,
    @param.filter(Dataset, {exclude: 'where'}) filter?: FilterExcludingWhere<Dataset>
  ): Promise<Dataset> {
    return this.datasetRepository.findById(id, filter);
  }

  @patch('/datasets/{id}')
  @response(204, {
    description: 'Dataset PATCH success',
  })
  async updateById(
    @param.path.string('id') id: string,
    @requestBody({
      content: {
        'application/json': {
          schema: getModelSchemaRef(Dataset, {partial: true}),
        },
      },
    })
    dataset: Dataset,
  ): Promise<void> {
    await this.datasetRepository.updateById(id, dataset);
  }

  @put('/datasets/{id}')
  @response(204, {
    description: 'Dataset PUT success',
  })
  async replaceById(
    @param.path.string('id') id: string,
    @requestBody() dataset: Dataset,
  ): Promise<void> {
    await this.datasetRepository.replaceById(id, dataset);
  }

  @del('/datasets/{id}')
  @response(204, {
    description: 'Dataset DELETE success',
  })
  async deleteById(@param.path.string('id') id: string): Promise<void> {
    await this.datasetRepository.deleteById(id);
  }

  //----------------------------------------------------------------------------

  @post('/Datasets/loadFromURL', {
    responses: {
      '200': {
        description: 'Get features in referenceAssemblyName for PanBARLEX Known Genes.',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async loadFromURL(
    @requestBody() dataDescription?: object,
  ): Promise<object> {
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object>(cb => {
      // @ts-ignore
      this.lb3.model.loadFromURL(dataDescription, options, cb);
    });
  }

  @get('/Datasets/vcfGenotypeFeaturesCountsStatus', {
    responses: {
      '200': {
        description: 'Get the status of .vcf.gz files for this dataset.',
        content: {'application/json': {schema: {type: 'string'}}},
      },
    },
  })
  async vcfGenotypeFeaturesCountsStatus(
    @inject(RestBindings.Http.RESPONSE) res: Response,
    @param.query.string('id') datasetId: string,
  ): Promise<string> {
    this.ensureLb3();
    await this.lb3.authUtils.authorizeDatasetRead(datasetId);
    noCacheResult(res);
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<string>(cb => {
      // @ts-ignore
      this.lb3.model.vcfGenotypeFeaturesCountsStatus(datasetId, options, cb);
    });
  }

  @post('/Datasets/upload', {
    responses: {
      '200': {
        description: 'Perform a bulk upload of a dataset with associated blocks and features',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async upload(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @requestBody() msg: object,
  ): Promise<object> {
    const contentType = req.headers['content-type'];
    if (
      !msg ||
      Buffer.isBuffer(msg) ||
      (contentType && !contentType.includes('application/json'))
    ) {
      throw new HttpErrors.UnsupportedMediaType(
        'Binary uploads must use POST /Datasets/uploadFile with fileName query param or X-File-Name header',
      );
    }
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object>(cb => {
      // @ts-ignore
      this.lb3.model.upload(msg, options, req, cb);
    });
  }

  @post('/Datasets/uploadFile', {
    responses: {
      '200': {
        description: 'Upload a dataset from a binary file payload',
        content: {'application/json': {schema: {type: 'object'}}},
      },
    },
  })
  async uploadFile(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @requestBody({
      description: 'Binary file content for dataset upload.',
      required: true,
      content: {
        'application/octet-stream': {
          schema: {type: 'string', format: 'binary'},
        },
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
          schema: {type: 'string', format: 'binary'},
        },
        'application/vnd.ms-excel': {
          schema: {type: 'string', format: 'binary'},
        },
        'application/vnd.oasis.opendocument.spreadsheet': {
          schema: {type: 'string', format: 'binary'},
        },
        'text/gff3': {
          schema: {type: 'string', format: 'binary'},
        },
      },
    })
    body: string,
    @param.query.string('fileName') fileName?: string,
    @param.query.boolean('replaceDataset') replaceDataset?: boolean,
  ): Promise<object> {
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const accessToken = this.lb3.authUtils.getAccessToken();
    const options = { accessToken };
    const headerFileName = req.headers['x-file-name'];
    const resolvedFileName =
      fileName || (Array.isArray(headerFileName) ? headerFileName[0] : headerFileName);
    if (!resolvedFileName) {
      throw new HttpErrors.BadRequest(
        'fileName query param or X-File-Name header is required',
      );
    }
    const msg = {
      fileName: resolvedFileName,
      data: body,
      replaceDataset,
    };
    return this.lb3.lb3Call<object>(cb => {
      // @ts-ignore
      this.lb3.model.upload(msg, options, req, cb);
    });
  }

  @post('/Datasets/tableUpload', {
    responses: {
      '200': {
        description: 'Perform a bulk upload of a features from tabular form',
        content: {'application/json': {schema: {type: 'string'}}},
      },
    },
  })
  async tableUpload(
    @requestBody() data: object,
  ): Promise<string> {
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<string>(cb => {
      // @ts-ignore
      this.lb3.model.tableUpload(data, options, cb);
    });
  }

  @post('/Datasets/createComplete', {
    responses: {
      '200': {
        description: 'Creates a dataset and all of its children',
        content: {'application/json': {schema: {type: 'string'}}},
      },
    },
  })
  async createComplete(
    @inject(RestBindings.Http.REQUEST) req: Request,
    @requestBody() data: object,
  ): Promise<string> {
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<string>(cb => {
      // @ts-ignore
      this.lb3.model.createComplete(data, options, req, cb);
    });
  }

  @get('/Datasets/cacheClear', {
    responses: {
      '200': {
        description: 'Clear cached copies of datasets / blocks / features from a secondary Pretzel API server.',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async cacheClear(
    @param.query.number('time') time: number,
  ): Promise<object[]> {
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.cacheClear(time, options, cb);
    });
  }

  @post('/Datasets/cacheblocksFeaturesCounts', {
    responses: {
      '200': {
        description: 'Pre-warm the cache of blockFeaturesCounts for each block of this dataset.',
        content: {'application/json': {schema: {type: 'number'}}},
      },
    },
  })
  async cacheblocksFeaturesCounts(
    @param.query.string('id') id: string,
    @requestBody() userOptions?: object,
  ): Promise<number> {
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<number>(cb => {
      // @ts-ignore
      this.lb3.model.cacheblocksFeaturesCounts(id, userOptions, options, cb);
    });
  }

  @get('/Datasets/naturalSearch', {
    responses: {
      '200': {
        description: 'Use OpenAI to convert search_text to an vector embedding and search for matching datasets using Vectra.',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async naturalSearch(
    @param.query.string('search_text') searchText: string,
  ): Promise<object[]> {
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.naturalSearch(searchText, options, cb);
    });
  }

  @get('/Datasets/text2Commands', {
    responses: {
      '200': {
        description: 'Use OpenAI to convert commands_text to text commands for viewing datasets.',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async text2Commands(
    @param.query.string('commands_text') commandsText: string,
  ): Promise<object[]> {
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.text2Commands(commandsText, options, cb);
    });
  }

  @get('/Datasets/getEmbeddings', {
    responses: {
      '200': {
        description: 'Get vector embeddings of metadata of all datasets.',
        content: {'application/json': {schema: {type: 'array', items: {type: 'object'}}}},
      },
    },
  })
  async getEmbeddings(): Promise<object[]> {
    this.ensureLb3();
    this.lb3.bindLb3DataSource();
    const options = null;
    return this.lb3.lb3Call<object[]>(cb => {
      // @ts-ignore
      this.lb3.model.getEmbeddings(options, cb);
    });
  }

  private ensureLb3() {
    if (!this.lb3) {
      this.lb3 = this.lb3WrapFactory(DatasetModule);
    }
  }
}
