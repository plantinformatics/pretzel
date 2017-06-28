'use strict';

module.exports = function(Client) {
  //send verification email after registration
  Client.afterRemote('create', function(context, userInstance, next) {
    console.log('> user.afterRemote triggered');

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
      next()
    });
  });

  Client.on('resetPasswordRequest', function (info) {
    console.log(info.email); // the email of the requested user
    console.log(info.accessToken.id); // the temp access token to allow password reset

    // var url = 'http://' + config.host + ':' + config.port + '/reset-password';
    var url = 'http://' + process.env.API_HOST + ':' + process.env.API_PORT_EXT + '/reset';
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

  });


};
