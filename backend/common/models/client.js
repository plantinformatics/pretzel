'use strict';

module.exports = function(Client) {
  //send verification email after registration
  Client.afterRemote('create', function(context, userInstance, next) {
    console.log('> user.afterRemote triggered');

    if (process.env.EMAIL_ACTIVE == 'true'){

      var options = {
        type: 'email',
        to: userInstance.email,
        from: process.env.EMAIL_FROM,
        subject: 'Welcome to DAV127',
        host: process.env.API_HOST,
        // template: path.resolve(__dirname, '../../server/views/verify.ejs'),
        text: "<h1>Thanks.</h1>",
        redirect: '/verified',
        user: Client
      };

      userInstance.verify(options, null, function(err, response) {
        if (err) return next(err);

        console.log('> verification email sent:', response);

        // response object is the following structure:
        // { email, id }
        context.result.code = 'EMAIL_VERIFY'
        next()
      });
    } else {
      console.log('created user, no verification email sent')
      context.result.code = 'EMAIL_UNVERIFIED'
      next()
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

  // Client.disableRemoteMethodByName("confirm");
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
