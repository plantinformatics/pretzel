import Ember from 'ember';
import Base from 'ember-simple-auth/authenticators/base';

export default Base.extend({
  restore: function(data) {
    return new Ember.RSVP.Promise(function(resolve, reject){
      if(!Ember.isEmpty(data.token)) {
        resolve(data);
      } else {
        reject();
      }
    });
  },

  authenticate: function(identification, password) {
    let config = Ember.getOwner(this).resolveRegistration('config:environment')
    let endpoint = config.apiHost + '/api/Clients/login'
    return new Ember.RSVP.Promise((resolve, reject) => {
      Ember.$.ajax({
        url: endpoint,
        type: 'POST',
        crossDomain: true,
        data: JSON.stringify({
            email:    identification,
            password: password
        }),
        contentType: 'application/json'
      }).then(function(response){
        // console.log(response)
        Ember.run(function(){
          resolve({
            token: response.id
          });
        });
      }, function(xhr, status, error) {
        var response = xhr.responseText;
        Ember.run(function(){
          reject(response);
        });
      });
    });
  },

  invalidate: function() {
    return Ember.RSVP.resolve();
  }

});