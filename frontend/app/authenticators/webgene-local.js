import Ember from 'ember';
import Base from 'ember-simple-auth/authenticators/base';

export default Base.extend({

  tokenEndPoint: 'http://localhost:3000/api/Clients/login',

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
    console.log('authenticate', identification, password)
    return new Ember.RSVP.Promise((resolve, reject) => {
      Ember.$.ajax({
        url: this.tokenEndPoint,
        type: 'POST',
        crossDomain: true,
        data: JSON.stringify({
          // session: {
            email:    identification,
            password: password
          // }
        }),
        contentType: 'application/json'
        // dataType: 'json'
      }).then(function(response){
        // console.log(response)
        // console.log('LOGIN OK: ' + response.id);
        Ember.run(function(){
          resolve({
            token: response.id
          });
        });
      }, function(xhr, status, error) {
        var response = xhr.responseText;
        // console.log('LOGIN ERROR: ' + response);
        Ember.run(function(){
          reject(response);
        });
      });
    });
  },

  invalidate: function() {
    // console.log('Invalidate Session....');
    return Ember.RSVP.resolve();
  }

});