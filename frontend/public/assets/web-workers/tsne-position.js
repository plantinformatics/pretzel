/* global postMessage importScripts */

// import TSNE from '../../../node_modules/tsne-js/tsne-js';
/*
importScripts('tsne-js');
importScripts('../../../node_modules/tsne-js/tsne-js');
*/
/* global TSNE */
importScripts('./tsne.min.js');

// define exports to enable import of cosineSimilarity.js
if (typeof exports === 'undefined') {
  var exports = self.exports = {};
}
// from vector-cosine-similarity
importScripts('./cosineSimilarity.js');
if (typeof cosineSimilarity === 'undefined') {
  var cosineSimilarity = self.exports.cosineSimilarity;
}
console.log('public/assets/web-workers/test.js', navigator, self, TSNE, this.hasOwnProperty('TSNE'), typeof cosineSimilarity);


//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

// Wait for the initial message event.
self.addEventListener('message', function(e) {
  var data = e.data;
  var port = e.ports[0];

  console.log('test message', port, data, e);
  if (port) {
    // Message received by a worker created with 'open' method.
  } else {
    // Message received by a worker created with 'send' or 'on' method.
    const [nodes, graphDimensions] = data;
    const tsnePosition = new TsnePosition(progressData);
    tsnePosition.tsnePosition(nodes, graphDimensions /*, progressData*/);
    function progressData(outputScaled) {
      postMessage({outputScaled});
    }
    postMessage({ finished : true });
  }

}, false);

// Ping the Ember service to say that everything is ok.
postMessage({ started : true });

//------------------------------------------------------------------------------

class TsnePosition {

  //----------------------------------------------------------------------------

  constructor(progressDataScaled, graphDimensions) {
    this.progressDataScaled = progressDataScaled;
  }

  //----------------------------------------------------------------------------

  /**
   * @param nodes .x,.y are added to each of nodes[], and nodes is returned.
   * @return nodes
   */
  tsnePosition(nodes, graphDimensions /*, progressDataScaled*/) {
    const fnName = 'tsnePosition';
    dLog(fnName, nodes.length);
    this.nodes = nodes;
    this.graphDimensions = graphDimensions;
    const
    inputData = nodes.map((n, i) => nodes.map((m, j) => this.force(i, j)));
    dLog(fnName, nodes.length);

    let model = new TSNE({
      dim: 2,
      perplexity: 30.0,
      earlyExaggeration: 4.0,
      learningRate: 100.0,
      nIter: 150/*1000*/,
      metric: 'euclidean'
    });

    // inputData is a nested array which can be converted into an ndarray
    // alternatively, it can be an array of coordinates (second argument should be specified as 'sparse')
    model.init({
      data: inputData,
      type: 'dense'
    });
    model.on('progressData', this.progressData.bind(this), /*context*/model);
    // context is not passed to progressData.
    this.model = model;

    // `error`,  `iter`: final error and iteration number
    // note: computation-heavy action happens here
    let [error, iter] = model.run();

    if (false) {
    // rerun without re-calculating pairwise distances, etc.
    let [error, iter] = model.rerun();
    }
    model.removeListener('progressData', this.progressData.bind(this), /*context*/model);
    dLog(fnName, nodes.length);

    return this.nodesScaled(model, nodes);
  }
  nodesScaled(model, nodes) {
    const fnName = 'nodesScaled';

    // `output` is unpacked ndarray (regular nested javascript array)
    let output = model.getOutput();

    // `outputScaled` is `output` scaled to a range of [-1, 1]
    let outputScaled = model.getOutputScaled();
    dLog(fnName, outputScaled[0], outputScaled.length);

    const {width, height} = this.graphDimensions;
    nodes.forEach((n, i) => {
      n.x = (1 + outputScaled[i][0]) * width / 2;
      n.y = (1 + outputScaled[i][1]) * height / 2;
    });
    dLog(fnName, nodes.length);

    return nodes;
  }

  progressData(outputScaled, model) {
    dLog('progressData', outputScaled[0], model, arguments);
    // Ember_set(this, 'nodesWithPosition', );
    const nodesScaled = this.nodesScaled(this.model, this.nodes);
    this.progressDataScaled(nodesScaled);
    // this.drawGraphIfReady();
  }

  //----------------------------------------------------------------------------
  // uses cosineSimilarity(), from vector-cosine-similarity
  /** forces[i][j] is vector similarity between nodes i and j, for i < j
   */
  forces = [];
  force(i, j) {
    if (i > j) {
      const swap = i;
      i = j;
      j = swap;
    }
    const
    forces = this.forces,
    fi = forces[i] || (forces[i] = []);
    let f = fi[j];
    if (! f) {
      const
      nodes = this.nodes,
      similarity = cosineSimilarity(nodes[i].vector.vector, nodes[j].vector.vector);
      f = fi[j] = similarity;
    }
    return f;
  }

};  // TsnePosition

  //----------------------------------------------------------------------------

//------------------------------------------------------------------------------
