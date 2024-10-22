import Component from '@glimmer/component';
import { computed, action, set as Ember_set } from '@ember/object';
import { inject as service } from '@ember/service';
import { later } from '@ember/runloop';
import { tracked } from '@glimmer/tracking';


import { bboxCollide } from 'd3-bboxCollide';
import { cosineSimilarity } from 'vector-cosine-similarity';
import TSNE from 'tsne-js';


/* global d3 */
/* global Worker */

import { toPromiseProxy } from '../../utils/ember-devel';
import { hoverConfigure, configureHover } from '../../utils/hover';


//------------------------------------------------------------------------------

const dLog = console.debug;

const useCanvas = false;
const textTransitionTime = 100;

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

  @computed()
  get worker() {
      /*, import.meta.url { type: "module" }*/
    const worker = new Worker('assets/web-workers/tsne-position.js');
    return worker;
  }

  simulation = null;
  willDestroyElement() {
    if (this.simulation) {
      this.simulation.stop();
    }

    this._super(...arguments);
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
        this.drawGraphIfReady();
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

  svgS = null;

  @action
  initialise() {
    if (! useCanvas) {
      this.svgS = d3.select('svg#dataset-graph-svg');
    }
    this.setupDimensions();

    later(() => {
      const n = this.nodesWithPositionRun;
      // progressData() calls drawGraphIfReady()
      // may change to pass nodes to drawGraph*()
      // n && this.drawGraphIfReady();
    });

  }

  @computed()
  get canvasContext() {
    const canvas = document.getElementById("dataset-graph-canvas");
    const ctx = canvas.getContext("2d");
    return ctx;
  }
  @action
  step() {
    if (useCanvas) {
      this.chart(this.canvasContext);
    } else {
      dLog('step', 'not implemented for SVG');
    }
  }
  //----------------------------------------------------------------------------

  /** Same as tsnePosition(), via web worker.
   */
  tsnePositionWorker(nodes, progressData) {
    const
    worker = this.worker;
    // worker = new Worker('assets/web-workers/tsne-position.js', { type: "module" });
    worker.postMessage([nodes, this.graphDimensions]);
    worker.onmessage = (e) => {
      dLog("Message received from worker", e.data, e);
      /* worker sends an initial message data={ started : true},
       * and a final message data={ finished : true}.
       * The start and finish messages do not contain .outputScaled
       */
      if ((! e.data.started) && ! e.data.finished) {
        progressData(e.data.outputScaled);
      }
    };
    worker.onerrormessage = (e) => {
      dLog("Error message received from worker", e);
    };

  }

  /**
   * @param nodes .x,.y are added to each of nodes[], and nodes is returned.
   * @return nodes
   */
  tsnePosition(nodes, progressData) {
    const fnName = 'tsnePosition';
    dLog(fnName, nodes.length);
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
    model.on('progressData', progressData, /*context*/model);
    // context is not passed to progressData.
    this.model = model;

    // `error`,  `iter`: final error and iteration number
    // note: computation-heavy action happens here
    let [error, iter] = model.run();

    if (false) {
    // rerun without re-calculating pairwise distances, etc.
    let [error, iter] = model.rerun();
    }
    model.removeListener('progressData', progressData, /*context*/model);
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
    // outputScaled is from : this.nodesScaled(this.model, this.nodes)
    Ember_set(this, 'nodesWithPosition', outputScaled);
    this.drawGraphIfReady();
  }


  //----------------------------------------------------------------------------
  // based on https://observablehq.com/@d3/collision-detection

  @computed('args.datasetEmbeddings')
  get nodes() {
    const
    nodes = this.args.datasetEmbeddings.responseJSON
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
  @tracked
  nodesWithPosition = null;
  @computed('nodes', 'graphDimensions')
  get nodesWithPositionRun() {
    const fnName = 'nodesWithPositionRun';
    const nodes = this.tsnePositionWorker(this.nodes, this.progressData.bind(this));
    Ember_set(this, 'nodesWithPosition', nodes);
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

  @tracked
  graphDimensions = null;
  setupDimensions() {
    const
    width = window.innerWidth,
    height = window.innerHeight - 80;
    Ember_set(this, 'graphDimensions', {width, height});

    if (useCanvas) {
      // const context = DOM.context2d(width, height);
      const
      canvas = this.canvasContext.canvas;
      canvas.width = width;
      canvas.height = height;
    } else {
      this.svgS
        .attr('width', width /* "100%" */)
        .attr('height', height);
    }
  }
  chart(context)
  {
    const
    {width, height} = this.graphDimensions;

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
      .on("tick", this.drawGraphCanvas.bind(this));
    this.simulation = simulation;

    return context.canvas;
  }

  drawGraphIfReady() {
    if (useCanvas) {
        // graphDimensions is used by nodesWithPosition -> tsnePosition()
        if (this.canvasContext && this.graphDimensions && this.nodesWithPosition) {
          this.drawGraphCanvas();
        }
    } else {
      this.drawGraphSVG();
    }
  }

  drawGraphCanvas() {
    const
    context = this.canvasContext,
    {width, height} = this.graphDimensions;
    context.clearRect(0, 0, width, height);
    context.save();
    context.beginPath();
    const nodes = this.nodesWithPosition;
    const me = this;
    for (const d of nodes) {
      me.drawNodeCanvas(context, d);
    }
    context.fillStyle = "#ddd";
    context.fill();
    context.strokeStyle = "#333";
    context.stroke();
    context.restore();
  }

  drawGraphSVG() {
    const
    fnName = 'drawGraphSVG',
    svg = this.svgS,
    data = this.nodesWithPosition,
    textS = svg.selectAll('text')
      .data(data, d => d.id),
    textA = textS.enter()
      .append('text')
      .text(d => d.id),
    me = this;
    // hoverConfigure(false, '#dataset-graph', '#popoverTargetDg');
    const
    textM = textS.merge(textA);
    textM
      .transition().duration(textTransitionTime)
      .attr('x', d => d.x + d.width/2)
      .attr('y', d => d.y + d.height/2)
      .each(function (d) {
        const
        datasetId = d.id,
        {fontSize, colour} = me.nodeTextAttrs(datasetId);
        d3.select(this)
          .attr('font-size', fontSize + 'px')
          .attr('stroke', colour);
      })
    ;
    /* .transition() does not provide .on('mouseover') etc.
     * The mouseover / hover is only useful for the last call, and could be done
     * when {finished} is received.
     */
    textM
    // .each(function(d, i, g) { return me.configureHover(this, d, i, g); })
      .on('mouseover', (event, d) => { this.datasetIdSelected = d.id; });

    textS.exit().remove();
  }
  @tracked
  datasetIdSelected = null;
  configureHover(element, d, i, g) {
    return configureHover.apply(element, [this, this.description.bind(element)]);
  }
  /**
   * @param this  element
   */
  description(me, d, i, g) {
    return d.id;
  }

  nodeTextAttrs(datasetId) {
    let searchFilterMatch = this.datasetIdInResult(datasetId);
    if (searchFilterMatch === -1) {
      searchFilterMatch = undefined;
    }
    const fontSize = searchFilterMatch ? 6 + 2 * (3 - searchFilterMatch) : 6;

    const scheme = document.documentElement.getAttribute('data-darkreader-scheme');
    const colour = (searchFilterMatch !== undefined) ? "red" : scheme === 'dark' ? '#ffffff': '#000000';
    return {fontSize, colour};
  }

  drawNodeCanvas(ctx, d) {
    const datasetId = d.id;
    const {fontSize, colour} = this.nodeTextAttrs(datasetId);

    // based on https://stackoverflow.com/a/24565574
    ctx.font=fontSize + "px Georgia";
    ctx.textAlign="center"; 
    ctx.textBaseline = "middle";

    ctx.fillStyle = colour;
    ctx.fillText(d.id, d.x + d.width/2, d.y + d.height/2);
  }

}

