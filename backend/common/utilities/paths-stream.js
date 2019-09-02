const { Writable, Transform } = require('stream');

/* global require exports */

var trace_stream = 2;


exports.CacheWritable = class extends Writable {
  constructor(cache, cacheId) {
    super({objectMode: true});
    this.cache = cache;
    this.cacheId = cacheId;

  }
  _write(chunk, encoding, callback) {
    console.log('CacheWritable _write', chunk);
    debugger;
    let data = this.cache.get(this.cacheId);
    if (data)
      data = data.concat(chunk);
    else
      data = [];
    this.cache.put(this.cacheId, data);
    callback();
  }
};

exports.FilterPipe = class extends Transform {
  /**
   * @param filterFunction  args : data (array), intervals, result : filtered data.
   */
  constructor(intervals, filterFunction) {
    super({objectMode: true});
    this.intervals = intervals;
    this.filterFunction = filterFunction;
    this.countIn = 0;
    this.countOut = 0;
  }
  _transform(data, encoding, callback) {
    let intervals = this.intervals;
    if (trace_stream > 2 - (this.countIn < 3)*2)
      console.log('FilterPipe _transform', data, intervals.nFeatures, this.countIn, this.countOut);
    // data is a single document, not an array
    if (! data /*|| data.length */)
      debugger;
    else {
      this.countIn++;
      if (intervals.nFeatures && (this.countOut < intervals.nFeatures)) {
        let trace = trace_stream > 2 - (this.countIn < 3)*2;
        if (trace)
          intervals.trace_filter = 3;
        else
          delete intervals.trace_filter;
        let filteredData = this.filterFunction([data], this.intervals);
        if (trace)
          console.log('filteredData', filteredData, filteredData.length);
        if (filteredData && filteredData.length)
        {
          this.countOut++;
          this.push(filteredData);
        }
      }
      /*
      else if (trace_stream > 2 - (this.countOut < 3)*2)
      {
        console.log('countOut', this.countOut, intervals.nFeatures, this.countIn);
      }
       */
    }
    callback();
  }
};
