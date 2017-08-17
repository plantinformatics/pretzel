'use strict';

var path = require('path');

module.exports = function(Client) {
  //send verification email after registration
  Client.afterRemote('create', function(context, userInstance, next) {
    // console.log('> user.afterRemote triggered');
    // console.log(process.env.EMAIL_ADMIN)
    // console.log(process.env.EMAIL_VERIFY)

    if (process.env.EMAIL_VERIFY == 'NONE') {
        // console.log('created user with no verification email');
        context.result.code = 'EMAIL_NO_VERIFY';
        next();
    } else if (process.env.EMAIL_ACTIVE == 'true') {
      if (process.env.EMAIL_VERIFY == 'USER') {
        var options = {
          type: 'email',
          to: userInstance.email,
          from: process.env.EMAIL_FROM,
          subject: 'Welcome to Pretzel',
          host: process.env.API_HOST,
          // template: path.resolve(__dirname, '../../server/views/verify.ejs'),
          text: "<h1>Thanks.</h1>",
          redirect: '/verified',
          user: Client
        };

        userInstance.verify(options, null, function(err, response) {
          if (err) return next(err);

          // console.log('> verification email sent:', response);

          // response object is the following structure:
          // { email, id }
          context.result.code = 'EMAIL_USER_VERIFY';
          next()
        });
      } else if (process.env.EMAIL_ADMIN && process.env.EMAIL_ADMIN.length > 0) {
        var options = {
          type: 'email',
          to: process.env.EMAIL_ADMIN,
          from: process.env.EMAIL_FROM,
          subject: 'New Pretzel User Registration',
          user_email: userInstance.email, // for template
          host: process.env.API_HOST,
          template: path.resolve(__dirname, '../../server/views/email_verify.ejs'),
          text: "<h1>Thanks.</h1>",
          redirect: '/verified', // may be changed later for better handling
          user: Client
        };

        userInstance.verify(options, null, function(err, response) {
          if (err) return next(err);

          // console.log('> verification email sent:', response);
          // response object is the following structure:
          // { email, id }
          context.result.code = 'EMAIL_ADMIN_VERIFY';
          next();
        });
      } else {
        next(new Error('Email could not be sent, missing configuration'));
      }
    } else {
      next(new Error('Email could not be sent, missing configuration'));
    }
  });

  Client.on('resetPasswordRequest', function (info) {
    if (process.env.EMAIL_ACTIVE == 'true'){
      // var url = 'http://' + config.host + ':' + config.port + '/reset-password';
      var url = 'http://' + process.env.API_HOST + ':' + process.env.API_PORT_EXT + '/reset-password';
      var html = 'Click <a href="' + url + '?access_token=' +
          info.accessToken.id + '">here</a> to reset your password';

      // requires AccessToken.belongsTo(User)
      info.accessToken.user(function (err, user) {
        console.log(user); // the actual user
      });

      Client.app.models.Email.send({
        to: info.email,
        from: process.env.EMAIL_FROM,
        subject: 'DAV127 Password Reset',
        html: html
      }, function(err) {
        if (err) return console.log('> error sending password reset email');
        console.log('> sending password reset email to:', info.email);
      });
    } else {
      // TODO should a 404 response be sent for this request?
      console.log('reset password request, no email sent')
    }
  });

  // Client.disableRemoteMethodByName("create");
  Client.disableRemoteMethodByName("upsert");
  Client.disableRemoteMethodByName("updateAll");
  Client.disableRemoteMethodByName("prototype.updateAttributes");

  Client.disableRemoteMethodByName("find");
  Client.disableRemoteMethodByName("findById");
  Client.disableRemoteMethodByName("findOne");

  Client.disableRemoteMethodByName("deleteById");

  // Client.disableRemoteMethodByName("confirm"); // this method is required for user auth handling
  Client.disableRemoteMethodByName("count");
  Client.disableRemoteMethodByName("exists");
  // Client.disableRemoteMethodByName("resetPassword");

  Client.disableRemoteMethodByName('prototype.__count__accessTokens');
  Client.disableRemoteMethodByName('prototype.__create__accessTokens');
  Client.disableRemoteMethodByName('prototype.__delete__accessTokens');
  Client.disableRemoteMethodByName('prototype.__destroyById__accessTokens');
  Client.disableRemoteMethodByName('prototype.__findById__accessTokens');
  Client.disableRemoteMethodByName('prototype.__get__accessTokens');
  Client.disableRemoteMethodByName('prototype.__updateById__accessTokens');
};
