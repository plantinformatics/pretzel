'use strict';

module.exports = function(Client) {
  //send verification email after registration
  Client.afterRemote('create', function(context, userInstance, next) {
    console.log('> user.afterRemote triggered');

    var options = {
      type: 'email',
      to: userInstance.email,
      from: 'test@example.com',
      subject: 'Thanks for registering.',
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
};
