import Component from '@glimmer/component';
import { computed, action } from '@ember/object';

import { bboxCollide } from 'd3-bboxCollide';
import { cosineSimilarity } from 'vector-cosine-similarity';

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


  @computed('args.datasetEmbeddings')
  get datasetEmbeddings() {
    let proxy = toPromiseProxy(this.args.datasetEmbeddings);
    return proxy;
  }

  @action
  start() {
    const canvas = document.getElementById("dataset-graph-canvas");
    const ctx = canvas.getContext("2d");
    this.chart(ctx);
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
        n.height = 2;
        n.width = n.id.length;
        return n;
      });
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


  chart(context)
  {
    // const context = DOM.context2d(width, height);
    const width=1200, height=850;
    // const nodes = this.radii().map(r => ({r}));
    const nodes = this.nodes;

    const rectangleCollide = bboxCollide([[-10,-5],[10,5]]);

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
      // .force("collide", rectangleCollide)
      .on("tick", ticked);
    this.simulation = simulation;
    const me = this;

    function ticked() {
      context.clearRect(0, 0, width, height);
      context.save();
      context.beginPath();
      for (const d of nodes) {
        me.drawNode(context, d);
      }
      context.fillStyle = "#ddd";
      context.fill();
      context.strokeStyle = "#333";
      context.stroke();
      context.restore();
    }

    return context.canvas;
  }

  drawNode(ctx, d) {
    // from https://stackoverflow.com/a/24565574
    ctx.font="20px Georgia";
    ctx.textAlign="center"; 
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#000000";
    ctx.fillText(d.id, d.x + d.width/2, d.y + d.height/2);
  }

  radii() {
    return (Array.from({length: 1000}, d3.randomUniform(4, 18)));
  }

}

