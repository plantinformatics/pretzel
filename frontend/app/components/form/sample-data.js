import Component from '@ember/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { computed, set as Ember_set } from '@ember/object';

import Plotly from 'plotly.js-dist';
import PCA from 'pca-js';

//------------------------------------------------------------------------------

const dLog = console.debug;

const trace = 0;

/** <input type="range" ...  min="0" max="200" */
const groupOffsetIntMax = 200;

//------------------------------------------------------------------------------

/** If string contains a space, trim from the first space onwards.
 */
function stringTrimFromSpace(string) {
  return string === undefined ? string : string.split(' ')[0] || string;
}

const
hovertemplate =
  '<b>%{text}</b><br>' +
  'PC1: %{x:.2f}<br>' +
  'PC2: %{y:.2f}<br>' +
  '%{customdata.trace}<br>' +
  '%{customdata.j}<br>' +
  '%{customdata.index}<br>' +
  '%{customdata.passport}<br>'; /* +
  '<extra></extra>'; */


//------------------------------------------------------------------------------

/** Form::SampleData
 *
 * @param @data  (table-brushed : #each .sampleData)
 * @param @samplesPassport=(table-brushed : .samplesPassport)
 * @param @datasetId=(table-brushed : .datasetId)
 */
export default class SampleDataComponent extends Component {
  data = null;
  @tracked
  /** .vector2d[0] and [1] are PCA PC1 & PC2, used for x & y in chart.
   * This is output of calculateData(), input to showData(). */
  vector2d = null;

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    if (window.PretzelFrontend) {
      window.PretzelFrontend.sampleData = this;
    }
  }

  errorMessage = '';
  @action
  didInsertElement() {
    if (! this.samplesPassport ?? Object.keys(this.samplesPassport).length) {
      this.errorMessage = 'Get Passport data for dataset samples';
    }

    if (this.data) {
      this.calculateData();
    }
  }

  //----------------------------------------------------------------------------

  calculateData() {
    const data = this.data;
    const sampleValues = Object.values(this.data);

    // Perform PCA
    const pcaData = PCA.getEigenVectors(sampleValues);
    const reducedData = PCA.computeAdjustedData(sampleValues, pcaData[0], pcaData[1]);
    this.vector2d = reducedData.adjustedData;
    // or .formattedAdjustedData
  }

  //----------------------------------------------------------------------------

  @computed('vector2d', 'groupOffset')
  get showDataEffect() {
    if (this.vector2d) {
      this.showData();
    }
  }
  showData() {
    const
    data = this.data,
    sampleNames = Object.keys(this.data),
    vector2d = this.groupOffset ? 
      offsets(this.groupOffset, this.vector2d) :
      this.vector2d;

    let traces;
    const traceConfig = {
        mode: 'markers',
        type: 'scattergl',
    };
    const samplesPassport = this.samplesPassport;
    if (samplesPassport) {
      const
      dataIndexed = Object.entries(data).map(([sampleName, value], index) =>
        ({sampleName, value, index})),
      groups = Object.groupBy(dataIndexed, ({sampleName}, i) => {
        const
        passport = samplesPassport[sampleName],
        key = ! passport ? "No Passport Data" :
          passport.subRegion ||
          passport.region ||
          passport.countryOfOrigin?.name ||
          stringTrimFromSpace(passport.accessionName) ||
          stringTrimFromSpace(passport.aliases?.[0]) ||
          passport.doi ||
          Object.entries(passport)?.[0]?.[1];
        return key;
      });
      traces = Object.entries(groups).map(([key, g], i) => {
      const trace = {
        /** to show overlapping points as a series of offset points in a line,
         * add to x value : + j/100 */
        x: g.map(({index}, j) => vector2d[0][index]),
        y: g.map(({index}) => vector2d[1][index]),
        text: g.mapBy('sampleName'),
        name: key,
        // hovertemplate,
        customdata : g.map(({sampleName, index}, j) =>
          ({trace : i, j, index,
            passport : JSON.stringify(samplesPassport[sampleName]),
            data : this.data[sampleName]?.join(',')
           })),
        ... traceConfig
      };
        return trace;
      });
    } else {
      const trace = {
        x: vector2d[0],
        y: vector2d[1],
        text: sampleNames,
        ... traceConfig
      };
      traces = [trace];
    }

    const layout = {
      title: this.datasetId,
      xaxis: { title: 'PC1' },
      yaxis: { title: 'PC2' },
    };

    const plotDiv = this.element.querySelector('#plot');
    Plotly.newPlot(plotDiv, traces, layout);

    plotDiv.on('plotly_hover', function(data) {
      // Update external element content and position
      var hoverInfo = document.getElementById('plot-hover-info');
      hoverInfo.innerHTML = hoverDataHtml(data);
      // Position the hoverInfo element as needed
    });
    if (false)
      plotDiv.on('plotly_unhover', function() {
        // Optionally clear the hover info
        var hoverInfo = document.getElementById('plot-hover-info');
        hoverInfo.innerHTML = '';
      });

  }

  //----------------------------------------------------------------------------

  groupOffsetInt = 100;
  @tracked
  groupOffset = 1;

  /** Adjust offset of points which have the same position.

   * This initial default value is coordinated with hbs : <input ... value=100 ... groupOffsetInput >
   * Factor domain is [0, 10], default 0.
   * <input> range is [0, 200]; divide value by /20
   * this.groupOffset{Int,}
   */

  @action
  groupOffsetInput(event) {
    this.groupOffsetInt = +event.target.value;
    /**
     * event.target.value is a string; convert to a number.
     */
    let value = (+event.target.value || 0) / 20;
    dLog('groupOffsetInput', value, event.target.value);
    /* .groupOffset is tracked by showData() */
    Ember_set(this, 'groupOffset', value);
  }


  //----------------------------------------------------------------------------


}

//------------------------------------------------------------------------------

function pointHtml(point) {
const
  customdata = point.customdata,
  fullData = point.fullData,
  text = `
  <tr>
    <td>${point.text}</td>
    <td>${point.x.toFixed(2)}</td>
    <td>${point.y.toFixed(2)}</td>
    <td style="background-color:${fullData.uid}">
      ${customdata.trace}=${point.curveNumber}</td>
    <td>${customdata.j}</td>
    <td>${customdata.index}</td>
    <td>${customdata.passport}</td>
    <td>${customdata.data}</td>
  </tr>
`;
  return text;
}
function hoverDataHtml(data) {
  const
  tableText =
    '<table style=\
      "border-collapse: initial;\
       border-spacing: 1em;" >\
  <thead>\
    <tr>\
      <th>text</th>\
      <th>x</th>\
      <th>y</th>\
      <th>trace</th>\
      <th>j</th>\
      <th>index</th>\
      <th>passport</th>\
      <th>data</th>\
    </tr>\
  </thead>\
  <tbody>\
' +
    data.points.map(pointHtml) +
    '</table>' +

    '<div>' +
    'xvals: ' + data.xvals.map(x => x.toFixed(2)).join(', ') + '<br>' +
    'yvals: ' + data.yvals.map(x => x.toFixed(2)).join(', ') + '<br>' +
    '</div>';
  return tableText;
}

//------------------------------------------------------------------------------

/* global d3 */

// const x = v[0].map((x,i) => ''+x+'|' + v[1][i]).sort().uniq();

/**
 * @param v	vector2d, i.e. [[x values], [y values]]
 * @return vector2d + offsets
 */
/*var offsets =*/ function offsets(groupOffset, v) {
  const
  /** group each element by its position [v[0][i], v[1][i]] (i.e. [PC1, PC2]).  */
  groups = v[0].reduce(
    (g, x, i) => {
      const
      y = v[1][i],
      /** convert position to a text key for grouping
       * Points within 0.1% are too close for hover to separate them, so use
       * groupOffset for these.
       */
      key = '' + x.toFixed(2) + '|' + y.toFixed(2),
      group = g[key] || (g[key] = []);
      group.push([i, v[0], v[1]]);
      return g;
    },
    {});
  /**  Calculate the next square larger than a given number range [0 .. n], and
   *  define grid positions within the square for each number in the range, and
   *  calculate offsets to each grid position, given a pixel length for each grid cell.
   */
  const
  extents = v.map(vi => d3.extent(vi)),
  lengths = extents.map(e => e[1] - e[0]),
  cellSize = (lengths[0] + lengths[1]) * groupOffset / 100;
  const offsetV = Object.values(groups).reduce((ov, group) => {
    const result = nextSquareAndOffsets(group.length, cellSize);
    dLog(result);
    result.positions.forEach((cell, i) => {
      const {gi, x, y} = group[i];
      [0, 1].forEach(j => ov[j][i] = v[j][i] + cell[j]);
    });
    return ov;
  }, [[], []]);
  return offsetV;
};
// offsets(v);

/* Calculate the next square larger than a given number range [0 .. n], and
 * define grid positions within the square for each number in the range, and
 * calculate offsets to each grid position, given a pixel length for each grid cell.
 *
 * This function is generated via ChatGPT 5 using the above description as prompt.
 *
 * ### To calculate the next square larger than a given number `n`, determine the smallest integer `k` such that \( k^2 > n \). The grid positions can be represented as a 2D matrix of size `k x k`, and offsets can be calculated based on the pixel length of each grid cell.
*/
var nextSquareAndOffsets = function nextSquareAndOffsets(n, cellSize) {
  /** ### Explanation:
   *   - The variable `k` is calculated as the ceiling of the square root of `n`.
   *   - For each number from `0` to `n-1`, the corresponding grid position is computed using integer division for rows and modulus for columns.
   *   - The offsets (`offsetX` and `offsetY`) are calculated by multiplying the row and column indices by the pixel length of each cell.
   */
  // Step 1: Calculate k
  const k = Math.ceil(Math.sqrt(n)), centre = k/2;

  // Step 2: Create an array to hold positions of numbers from 0 to n
  const positions = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / k); // Row index
    const col = i % k; // Column index
    const offsetX = (col - centre) * cellSize; // Offset in X direction
    const offsetY = (row - centre) * cellSize; // Offset in Y direction
    positions.push([offsetX, offsetY]);
  }

  // Step 3: Return k and the positions
  return { k, positions };
};
// Example usage:
function Example_usage() {
  const n = 10;
  const cellSize = 50;
  const result = nextSquareAndOffsets(n, cellSize);
  console.log(result.k); // Next square side length
  console.log(result.positions); // Array of grid positions
}

//------------------------------------------------------------------------------
