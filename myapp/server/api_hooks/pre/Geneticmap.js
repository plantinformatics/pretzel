exports.create = function(req, next) {

  /*var err;

  if (!(req.isAuthenticated() && req.user)) { // assuming you're using passport.js
    err = new Error('not allowed to access this resource');
    err.status = 403;
  }

  console.log(req.body.post);
  */
  console.log(req.body);
  next();

};

exports.read = function(req, next){
  console.log("request made");
  next();
};

exports.update = function (req, next){ 
  var err = new Error('not allowed to access this resource');
  err.status = 403;
  next(err);
};

exports.remove = function (req, next){ 
  var err = new Error('not allowed to access this resource');
  err.status = 403;
  next(err);
};
