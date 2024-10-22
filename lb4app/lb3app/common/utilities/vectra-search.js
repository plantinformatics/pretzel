/* global exports */
/* global require */
/* global process */
/* global __dirname */


/**
 * initially based on example in https://github.com/Stevenic/vectra/README.md
 */

/** Usage
 * First create an instance of LocalIndex with the path to the folder where you want you're items stored:
 */
//import { LocalIndex } from 'vectra';
const { LocalIndex } = require('vectra');
//import * as path from 'path';
const path = require('path');

// import { fileURLToPath } from 'url';
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

async function ensureIndex() {
  const index = new LocalIndex(path.join(__dirname, '..', 'index'));

  // Next, from inside an async function, create your index:
  if (!await index.isIndexCreated()) {
    console.log('createIndex', index);
    await index.createIndex();
  }
  return index;
}
const indexP = ensureIndex();

// Add some items to your index:

// import { OpenAIApi, Configuration } from 'openai';
const { OpenAIApi, Configuration } = require('openai');

function connectOpenAIApi() {
  let api;
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  if (OPENAI_API_KEY) {
    console.log('connectOpenAIApi', 'OPENAI_API_KEY', OPENAI_API_KEY.slice(-3));
    const configuration = new Configuration({
      apiKey: OPENAI_API_KEY,
    });
    api = new OpenAIApi(configuration);
  }

  return api;
}
const apiP = connectOpenAIApi();

const jsonPrompt = "The following is a JSON object containing metadata about a genomic dataset.\n---\n";
const datasetPrompt = "The following are the ID and metadata attributes of a genomic dataset :\n---\n";
async function getVector(text /*: string*/) {
  const api = await apiP;
  const response = await api.createEmbedding({
    'model': 'text-embedding-ada-002',
    'input': text,
  });
  return response.data.data[0].embedding;
}

async function addItem(id, text /*: string*/) {
  const index = await indexP;
  await index.insertItem({
    id,
    vector: await getVector(/*datasetPrompt +*/ text),
    metadata: { text }
  });
}

exports.ensureItem = ensureItem;
async function ensureItem(id, text /*: string*/) {
  const index = await indexP;
  const idInIndex = await index.getItem(id);
  console.log('ensureItem', id, !!idInIndex);
  if (! idInIndex) {
    await addItem(id, text);
  }
}

async function example_README_md() {
  // Add items
  await addItem('apple');
  await addItem('oranges');
  await addItem('red');
  await addItem('blue');
  // Then query for items:
  await query('green');
}

exports.query = query;
async function query(text /*: string*/) {
  const vector = await getVector(/*input*/text);
  const index = await indexP;
  const results = await index.queryItems(vector, 3);
  if (results.length > 0) {
    for (const result of results) {
      console.log(`[${result.score}] ${result.item.metadata.text}`);
    }
  } else {
    console.log(`No results found.`);
  }
  return results;
}

exports.datasetIdGetVector = datasetIdGetVector;
/** Lookup dataset id in vectra
 */
async function datasetIdGetVector(id) {
  const index = await indexP;
  const vector = await index.getItem(id);
  return vector;
}
