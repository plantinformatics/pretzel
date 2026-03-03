import {inject} from '@loopback/core';
import {
  BodyParser,
  Request,
  RequestBody,
  RequestBodyParserOptions,
  RestApplication,
  RestBindings,
} from '@loopback/rest';
import {raw} from 'body-parser';
import {is} from 'type-is';
import {
  getParserOptions,
  invokeBodyParserMiddleware,
} from '@loopback/rest';

export const DATASET_UPLOAD_FILE_MEDIA_TYPES: string[] = [
  'application/octet-stream',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/gff3',
];

export class DatasetUploadFileBodyParser implements BodyParser {
  name = Symbol('datasetUploadFileRaw');
  private readonly rawParser;

  constructor(
    @inject(RestBindings.REQUEST_BODY_PARSER_OPTIONS, {optional: true})
    options: RequestBodyParserOptions = {},
  ) {
    const rawOptions = getParserOptions('raw', options);
    rawOptions.type = DATASET_UPLOAD_FILE_MEDIA_TYPES;
    this.rawParser = raw(rawOptions);
  }

  supports(mediaType: string): boolean {
    return !!is(mediaType, DATASET_UPLOAD_FILE_MEDIA_TYPES);
  }

  async parse(request: Request): Promise<RequestBody> {
    const body = await invokeBodyParserMiddleware(this.rawParser, request);
    const contentType = request.headers['content-type'] ?? '';
    if (typeof body === 'string') {
      return {value: body};
    }
    if (is(contentType, 'text/gff3')) {
      return {value: body.toString('utf8')};
    }
    return {value: body.toString('binary')};
  }
}

export function registerDatasetUploadFileBodyParser(app: RestApplication): void {
  const limit = process.env.API4_UPLOAD_LIMIT ?? '2000mb';
  app.bind(RestBindings.REQUEST_BODY_PARSER_OPTIONS).to({
    raw: {limit},
  });
  app.bodyParser(DatasetUploadFileBodyParser);
}
