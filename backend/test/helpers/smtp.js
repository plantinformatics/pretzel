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
      let chunks = ''
      let scope = this;
      
      stream.on('data', chunk => {
          chunk = String(chunk).trim()
          chunk = chunk.replace(/=\r/g, '')
          chunks += chunk
      });

      stream.on('end', () => {
          callback();
          scope.emit('data', chunks)
      });
    },
});

module.exports = server;
