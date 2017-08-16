'use strict';

const {SMTPServer} = require('smtp-server');

const server = new SMTPServer({
    // logger: true,
    onAuth(auth, session, callback){
      if(auth.username !== process.env.EMAIL_USER || auth.password !== process.env.EMAIL_PASS){
        return callback(new Error('Invalid username or password'));
      }
      callback(null, {user: 123}); // where 123 is the user id or similar property
    },
    onData(stream, session, callback){
      // console.log('ONDATA')
      let chunklen = 0;
      let chunks = ''
      let scope = this;
      
      stream.on('data', chunk => {
          chunklen += chunk.length;
          chunk = String(chunk).trim()
          // console.log(chunk)
          // console.log(chunk.length)
          chunks += chunk
      });

      stream.on('end', () => {
          // console.log('CHUNKS', chunklen)
          callback();
          scope.emit('data', chunks)
      });
    },
});

module.exports = server;
