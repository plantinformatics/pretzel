var EventSource = require('eventsource')
var qs = require('qs')

var endpoint = require('./api').endpoint

/** This value is used in SSE packet event id to signify the end of the cursor in pathsViaStream. */
const SSE_EventID_EOF = '-1';

var allData = function({path, blockId0, blockId1, intervals, userToken}) {
  path = "/Blocks/pathsViaStream"
  let url = `${endpoint}${path}`+
            `?access_token=${userToken}`+
            `&blockA=${blockId0}`+
            `&blockB=${blockId1}`+
            `&${qs.stringify({ intervals })}`

  // console.log('url => ', url);
  return new Promise((resolve, reject) => {
    var source = new EventSource(url, {withCredentials: true});
    let data = [],
        count = 0

    function onMessage(e) {
      ++count
      // if (trace_paths > 2)
      // console.log('onMessage', e, e.type, e.data, arguments);
      if (e.lastEventId === SSE_EventID_EOF) {
        console.log('Message count => ', count);
        // This is the end of the stream
        source.close()
        console.log('data => ', data)
        resolve(data)
      }
      else {
        let msg = JSON.parse(e.data)
        console.log('msg => ', msg)
        if(Array.isArray(msg))
          msg =  msg[0]
        
        data.push(msg)
      }
    }

    source.addEventListener('pathsViaStream', onMessage, false);

    source.addEventListener('open', function(e) {
      console.log("Connection was opened", e.type, e)
    }, false)

    function onError(e) {
      let state = e.eventPhase // this.readyState seems constant.
      const stateName = ['CONNECTING', 'OPEN', 'CLOSED']
      console.log('listenEvents', e.type, e, this, ".readyState", this.readyState, state, stateName[state], e)
      if (state === EventSource.CLOSED) {
        resolve([])
      }
      else if (state == EventSource.CONNECTING) {
      }
      else
        reject(e)
    };
    source.onerror = onError;
  })
}

module.exports = {
  allData
}