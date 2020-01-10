let cache = require('memory-cache');
let memCache = new cache.Cache();

module.exports = function({duration}) {
  return (req, res, next) => {
    console.log("Checking cache...");

    let key =  '__express__' + req.originalUrl || req.url
    let cacheContent = memCache.get(key);
    if(cacheContent) {
      console.log("Cache hit");
      res.send( cacheContent );
      return
    } else {
      console.log("Cache miss");
      res.sendResponse = res.send
      res.send = (body) => {
          memCache.put(key,body,duration*1000);
          res.sendResponse(body)
      }
      next()
    }
  }
}