import {ApplicationConfig} from '@loopback/core';
import {PretzelApplication} from './application';

/**
 * Export the OpenAPI spec from the application
 */
async function exportOpenApiSpec(): Promise<void> {
  const config: ApplicationConfig = {
    rest: {
      port: +(process.env.PORT ?? process.env.API_PORT_EXT ?? 3000),
      host: process.env.HOST ?? '0.0.0.0',
    },
  };
  const outFile = process.argv[2] ?? '';
  const app = new PretzelApplication(config);
  await app.boot();
  await app.exportOpenApiSpec(outFile);
}

exportOpenApiSpec().catch(err => {
  console.error('Fail to export OpenAPI spec from the application.', err);
  process.exit(1);
});
