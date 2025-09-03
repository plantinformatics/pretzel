import Component from '@ember/component';
import { action } from '@ember/object';
import Plotly from 'plotly.js-dist';
import PCA from 'pca-js';

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

export default class SampleDataComponent extends Component {
  data = null;

  //----------------------------------------------------------------------------

  constructor() {
    super(...arguments);

    if (window.PretzelFrontend) {
      window.PretzelFrontend.sampleData = this;
    }
  }

  @action
  didInsertElement() {
    if (this.data) {
      this.showData();
    }
  }

  //----------------------------------------------------------------------------

  showData() {
    const data = this.data;
    const sampleNames = Object.keys(this.data);
    const sampleValues = Object.values(this.data);

    // Perform PCA
    const pcaData = PCA.getEigenVectors(sampleValues);
    const reducedData = PCA.computeAdjustedData(sampleValues, pcaData[0], pcaData[1]);
    const vector2d = reducedData.adjustedData;
    // or .formattedAdjustedData

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
        key =
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
        hovertemplate,
        customdata : g.map(({sampleName, index}, j) =>
          ({trace : i, j, index, passport : JSON.stringify(samplesPassport[sampleName])})),
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

    Plotly.newPlot(this.element.querySelector('#plot'), traces, layout);
  }

  //----------------------------------------------------------------------------

}
