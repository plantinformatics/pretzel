'use strict';

var path = require('path');

var loopback = require('loopback'); // for rendering template in custom methods

var acl = require('../utilities/acl')

module.exports = function(Client) {
  //send verification email after registration
  Client.afterRemote('create', function(context, userInstance, next) {
    // console.log('> user.afterRemote triggered');
    // console.log('process.env.EMAIL_ADMIN => ', process.env.EMAIL_ADMIN);
    // console.log(process.env.EMAIL_VERIFY)

    if (process.env.EMAIL_VERIFY == 'NONE') {
        // console.log('created user with no verification email');
        context.result.code = 'EMAIL_NO_VERIFY';
        next();
    } else if (process.env.EMAIL_ACTIVE == 'true') {
      var options = {
        type: 'email',
        to: userInstance.email,
        from: process.env.EMAIL_FROM,
        subject: 'Welcome to Pretzel',
        email_recipient: userInstance.email, // for template
        host: process.env.API_HOST,
        template: path.resolve(__dirname, '../../server/views/verify_user.ejs'),
        redirect: '/verified',
        user: userInstance
      };

      userInstance.verify(options, null, function(err, response) {
        if (err) return next(err);

        context.result.code = 'EMAIL_USER_VERIFY';
        next()
      });
    } else {
      next(new Error('Email could not be sent, missing configuration'));
    }
  });
  
  Client.beforeRemote('confirm', function(context, result, next) {
    // Check whether admin also has to verify the user
    if (process.env.EMAIL_ACTIVE == 'true' && process.env.EMAIL_VERIFY == 'ADMIN' && context.args.redirect == '/verified') {
      if (process.env.EMAIL_ADMIN && process.env.EMAIL_ADMIN.length > 0) {

        //Send access request email to admin
        Client.findById(context.args.uid).then(function(userInstance) {
          var options = {
            type: 'email',
            to: process.env.EMAIL_ADMIN,
            from: process.env.EMAIL_FROM,
            subject: 'New Pretzel User Registration',
            email_user: userInstance.email, // for template
            email_recipient: process.env.EMAIL_ADMIN, // for template
            host: process.env.API_HOST,
            template: path.resolve(__dirname, '../../server/views/verify_admin.ejs'),
            redirect: '/admin-verified',
            user: userInstance
          };

          userInstance.verify(options, null, function(err, response) {
            if (err) return next(err);

            //Redirect to prevent the user from being verified by loopback
            let res = context.res;
            res.redirect('/access-request');
            return;
          });
        });
        
      } else {
        next(new Error('Email could not be sent, missing configuration'));
      }
    } else {
      next();
    }
  });

  Client.afterRemote('confirm', function(context, result, next) {
    if (process.env.EMAIL_VERIFY == 'ADMIN' && context.args.redirect == '/admin-verified') {
      // Notify user that admin has accepted their access request
      if (process.env.EMAIL_ACTIVE == 'true') {
        Client.findById(context.args.uid).then(function(userInstance) {
          var template = loopback.template(path.resolve(__dirname, '../../server/views/access_granted.ejs'));
          var html = template({
            email_recipient: userInstance.email,
            login_url: context.req.protocol + '://' + context.req.host + ':' + process.env.API_PORT_EXT + '/login'
          });

          Client.app.models.Email.send({
            to: userInstance.email,
            from: process.env.EMAIL_FROM,
            subject: 'Welcome to Pretzel',
            html: html,
          }, function(err) {
            if (err) {
              console.log(err);
              console.log('> error sending access granted notification email');
              return;
            }
            console.log('> sending access granted notification email to:', userInstance.email);
          });
        });
      }
    }
    next();
  });

  Client.on('resetPasswordRequest', function (info) {
    if (process.env.EMAIL_ACTIVE == 'true'){
      var url = 'http://' + process.env.API_HOST + ':' + process.env.API_PORT_EXT + '/reset-password';
      var reset_href = url + '?access_token=' + info.accessToken.id;

      // when preparing non-standard emails, the template must
      // be built and provided as html to the send function
      let templateConfig = {
        email_recipient: info.email, // for template
        reset_href: reset_href, // for template
      }

      var template = loopback.template(path.resolve(__dirname, '../../server/views/password_reset.ejs'));
      var html = template(templateConfig);

      // requires AccessToken.belongsTo(User)
      // info.accessToken.user(function (err, user) {
      //   console.log(user); // the actual user
      // });

      Client.app.models.Email.send({
        to: info.email,
        from: process.env.EMAIL_FROM,
        subject: 'Pretzel Password Reset Request',
        html: html,
      }, function(err) {
        if (err) {
          console.log(err);
          console.log('> error sending password reset email');
          return;
        }
        console.log('> sending password reset email to:', info.email);
      });
    } else {
      // TODO should a 404 response be sent for this request?
      console.log('reset password request, no email sent')
    }
  });

  acl.limitRemoteMethodsRelated(Client)

  // Client.disableRemoteMethodByName("create");
  Client.disableRemoteMethodByName("upsert");
  Client.disableRemoteMethodByName("updateAll");
  Client.disableRemoteMethodByName("prototype.updateAttributes");

  Client.disableRemoteMethodByName("find");
  Client.disableRemoteMethodByName("findById");
  Client.disableRemoteMethodByName("findOne");

  Client.disableRemoteMethodByName("deleteById");

  Client.disableRemoteMethodByName("createChangeStream");

  // Client.disableRemoteMethodByName("confirm"); // this method is required for user auth handling
  Client.disableRemoteMethodByName("count");
  Client.disableRemoteMethodByName("exists");
  // Client.disableRemoteMethodByName("resetPassword");
  Client.disableRemoteMethodByName("upsertWithWhere");
};
