import {expect, Client} from '@loopback/testlab';
import supertest from 'supertest';
import {PretzelApplication} from '../..';
import {setupApplication} from './test-helper';

describe('block hooks', () => {
  let app: PretzelApplication;
  let client: Client | supertest.SuperTest<supertest.Test>;

  const CLIENT_ID = '60db102e162b5e27516170a2';

  before('setupApplication', async () => {
    const baseUrl = process.env.API_BASE_URL;
    if (baseUrl) {
      client = supertest(baseUrl);
      return;
    }
    ({app, client} = await setupApplication());
  });

  after(async () => {
    if (app) {
      await app.stop();
    }
  });

  it('cleans up features when block is deleted', async function () {
    const authHeader =
      process.env.AUTHORIZATION_HEADER ??
      (process.env.AUTH_TOKEN ? `Bearer ${process.env.AUTH_TOKEN}` : undefined);

    if (!authHeader) {
      this.skip();
      return;
    }

    const datasetId = `dataset_test_hooks_${Date.now()}`;

    await client
      .post('/api/datasets')
      .set('Authorization', authHeader)
      .send({
        name: datasetId,
        public: false,
        readOnly: true,
        namespace: '90k',
        tags: [],
        clientId: CLIENT_ID,
      })
      .expect(200);

    const blockRes = await client
      .post('/api/blocks')
      .set('Authorization', authHeader)
      .send({
        scope: '1A',
        namespace: '90k',
        datasetId,
        featureType: 'linear',
      })
      .expect(200);

    const blockId = blockRes.body.id;
    expect(blockRes.body.name).to.equal('1A');

    const featureRes = await client
      .post('/api/features')
      .set('Authorization', authHeader)
      .send({
        blockId,
        value: [98],
        name: 'marker1',
        value_0: 98,
      })
      .expect(200);

    const featureId = featureRes.body.id;

    await client.get(`/api/features/${featureId}`).expect(200);

    await client
      .delete(`/api/blocks/${blockId}`)
      .set('Authorization', authHeader)
      .expect(204);

    await client.get(`/api/features/${featureId}`).expect(404);
  });
});
