import Component from '@glimmer/component';
import { computed, action } from '@ember/object';
import { inject as service } from '@ember/service';


import { bboxCollide } from 'd3-bboxCollide';
import { cosineSimilarity } from 'vector-cosine-similarity';
import TSNE from 'tsne-js';


/* global d3 */

import { toPromiseProxy } from '../../utils/ember-devel';


//------------------------------------------------------------------------------

const dLog = console.debug;

//------------------------------------------------------------------------------

/** Show a message to the user, using alert().
 */
function userMessage(text) {
  alert(text);
}

//------------------------------------------------------------------------------


export default class FormDatasetGraphComponent extends Component {
  
  @service()
  auth;

  userMessage = userMessage;

  constructor() {
    super(...arguments);

    // used in development only, in Web Inspector console.
    if (window.PretzelFrontend) {
      window.PretzelFrontend.datasetGraph = this;
    }

    dLog('constructor', this.args.datasetEmbeddings);
  }

  simulation = null;
  willDestroyElement() {
    this._super(...arguments);

    if (this.simulation) {
      this.simulation.stop();
    }
  }

  //----------------------------------------------------------------------------

  naturalQuery = '';
  naturalQueryResult = null;
  naturalQueryResultRaw = null;
  naturalQueryChanged(value) {
    if (value?.length) {
      const options = {server : this.apiServerSelectedOrPrimary};
      this.auth.naturalSearch(value, options).then(results => {
        if (results?.length) {
          this.naturalQueryResultRaw = results;
          const ids = results.mapBy('item.id');
          this.naturalQueryResult = ids;
          // const datasetId = results[0].item.id;
        } else {
          this.naturalQueryResult = null;
        }
        // canvasDimensions is used by nodesWithPosition -> tsnePosition()
        if (this.canvasContext && this.canvasDimensions && this.nodesWithPosition) {
          this.drawGraph();
        }
    });
    }
  }

  /**
   * @return undefined if naturalQueryResult is not defined,
   * index of datasetId in naturalQueryResult, or -1 if not found.
   */
  datasetIdInResult(datasetId) {
    const
    // this.datasetEmbeddings.findBy('id', this.naturalQueryResult[0])

    // or dr = this.naturalQueryResultRaw.findBy('item.id', datasetId); score = dr?.score;
    // orig : this.naturalQueryResult?.includes(datasetId);
    score = this.naturalQueryResult?.indexOf(datasetId);
    return score;
  }

  //----------------------------------------------------------------------------


  @computed('args.datasetEmbeddings')
  get datasetEmbeddings() {
    let proxy = toPromiseProxy(this.args.datasetEmbeddings);
    return proxy;
  }

  @action
  initialise() {
    this.canvasSetup(this.canvasContext);
    if (this.nodesWithPosition) {
      this.drawGraph();
    }
  }

  @computed()
  get canvasContext() {
    const canvas = document.getElementById("dataset-graph-canvas");
    const ctx = canvas.getContext("2d");
    return ctx;
  }
  @action
  step() {
    this.chart(this.canvasContext);
  }
  //----------------------------------------------------------------------------

  /**
   * @param nodes .x,.y are added to each of nodes[], and nodes is returned.
   * @return nodes
   */
  tsnePosition(nodes) {
    const
    inputData = nodes.map((n, i) => nodes.map((m, j) => this.force(i, j)));

    let model = new TSNE({
      dim: 2,
      perplexity: 30.0,
      earlyExaggeration: 4.0,
      learningRate: 100.0,
      nIter: 1000,
      metric: 'euclidean'
    });

    // inputData is a nested array which can be converted into an ndarray
    // alternatively, it can be an array of coordinates (second argument should be specified as 'sparse')
    model.init({
      data: inputData,
      type: 'dense'
    });

    // `error`,  `iter`: final error and iteration number
    // note: computation-heavy action happens here
    let [error, iter] = model.run();

    if (false) {
    // rerun without re-calculating pairwise distances, etc.
    let [error, iter] = model.rerun();
    }

    // `output` is unpacked ndarray (regular nested javascript array)
    let output = model.getOutput();

    // `outputScaled` is `output` scaled to a range of [-1, 1]
    let outputScaled = model.getOutputScaled();

    const {width, height} = this.canvasDimensions;
    nodes.forEach((n, i) => {
      n.x = (1 + outputScaled[i][0]) * width / 2;
      n.y = (1 + outputScaled[i][1]) * height / 2;
    });
    return nodes;
  }

  //----------------------------------------------------------------------------
  // based on https://observablehq.com/@d3/collision-detection

  @computed('args.datasetEmbeddings')
  get nodes() {
      const nodes = this.args.datasetEmbeddings.responseJSON
      .map((n, i) => {
        n.idx = i;
        // n.x = i;
        // n.y = i;
        n.height = 3;
        n.width = n.id.length * 3;
        return n;
      });
    return nodes;
  }
  @computed('nodes', 'canvasDimensions')
  get nodesWithPosition() {
    const nodes = this.tsnePosition(this.nodes);
    return nodes;
  }

  @computed('nodes')
  get links() {
    const
    links = this.nodes.reduce((result, n, source) => {
      for (let target = 0; target < source; target++) {
        result.push({source, target});
      }
      return result;
    }, []);
    return links;
  }

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

  canvasSetup(context) {
    // const context = DOM.context2d(width, height);
    const
    canvas = context.canvas;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 80;
    const
    width = canvas.width,
    height = canvas.height;
    this.canvasDimensions = {width, height};
  }
  chart(context)
  {
    const
    {width, height} = this.canvasDimensions;

    // const nodes = this.radii().map(r => ({r}));
    const nodes = this.nodesWithPosition;

    function bboxCollideFn(d, i, g) {
      const
      w2 = d.width / 2,
      h2 = d.height / 2,
      bbox = [[-w2, -h2], [w2, h2]];
      return bbox;
    }
    // [[-200,-10], [200,10]]
    const rectangleCollide = bboxCollide(bboxCollideFn);

    const
    simulation = d3.forceSimulation(nodes)
      .velocityDecay(0.2)
        // .force("x", d3.forceX().strength(0.002))
        // .force("y", d3.forceY().strength(0.002))
    // d3.forceCollide().radius(d => d.r + 0.5).iterations(2)
      .force(
        "link",
        d3.forceLink(this.links)
          .id(d => d.idx)
          .distance((link) => this.force(link.source.idx, link.target.idx)))
      .force("charge", d3.forceManyBody().strength(-3000))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", rectangleCollide)
      .on("tick", this.drawGraph.bind(this));
    this.simulation = simulation;

    return context.canvas;
  }

    drawGraph() {
      const
      context = this.canvasContext,
      {width, height} = this.canvasDimensions;
      context.clearRect(0, 0, width, height);
      context.save();
      context.beginPath();
      const nodes = this.nodesWithPosition;
      const me = this;
      for (const d of nodes) {
        me.drawNode(context, d);
      }
      context.fillStyle = "#ddd";
      context.fill();
      context.strokeStyle = "#333";
      context.stroke();
      context.restore();
    }


  drawNode(ctx, d) {
    const datasetId = d.id;
    let searchFilterMatch = this.datasetIdInResult(datasetId);
    if (searchFilterMatch === -1) {
      searchFilterMatch = undefined;
    }
    const fontSize = searchFilterMatch ? 6 + 2 * (3 - searchFilterMatch) : 6;

    // based on https://stackoverflow.com/a/24565574
    ctx.font=fontSize + "px Georgia";
    ctx.textAlign="center"; 
    ctx.textBaseline = "middle";

    const scheme = document.documentElement.getAttribute('data-darkreader-scheme');
    ctx.fillStyle = (searchFilterMatch !== undefined) ? "red" : scheme === 'dark' ? '#ffffff': '#000000';
    ctx.fillText(d.id, d.x + d.width/2, d.y + d.height/2);
  }

  radii() {
    return (Array.from({length: 1000}, d3.randomUniform(4, 18)));
  }

}

