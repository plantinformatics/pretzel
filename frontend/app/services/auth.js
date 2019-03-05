import Ember from 'ember';

const { inject: { service }, Service, isEmpty } = Ember;

export default Service.extend({
  session: service('session'),

  changePassword(data) {
    return this._ajax('Clients/change-password', 'POST', JSON.stringify(data), true)
  },

  resetPassword(data, token) {
    return this._ajax('Clients/reset-password', 'POST', JSON.stringify(data), token)
  },

  resetRequest(data) {
    console.log('resetRequest')
    return this._ajax('Clients/reset', 'POST', JSON.stringify(data), false)
  },

  signupRequest(data) {
    console.log('signupRequest')
    return this._ajax('Clients/', 'POST', JSON.stringify(data), false)
  },

  uploadData(data) {
    return this._ajax('Datasets/upload', 'POST', JSON.stringify(data), true)
  },

  tableUpload(data) {
    return this._ajax('Datasets/tableUpload', 'POST', JSON.stringify(data), true)
  },

  getBlocks() {
    return this._ajax('Datasets', 'GET', {'filter[include]': 'blocks'}, true)
  },

  getPaths(blockA, blockB, options) {
    console.log('services/auth getPaths', blockA, blockB, options);
    return this._ajax('Blocks/paths', 'GET', {blockA : blockA, blockB : blockB, options : options}, true)
  },

  getPathsProgressive(blockA, blockB, intervals, options) {
    console.log('services/auth getPathsProgressive', blockA, blockB, intervals, options);
    return this._ajax('Blocks/pathsProgressive', 'GET', {blockA : blockA, blockB : blockB, intervals, options : options}, true);
  },

  /** Send GET request Blocks/pathsByReference,
   * i.e. retrieve the paths connecting blockA and blockB via the reference assembly,
   * allowing up to max_distance physical distance (base pairs) between the features in the reference.
   * @param blockA	type:string,	required: true
   * @param blockB	type:string,	required: true
   * @param reference	type:string,	required: true  genome assembly
   * @param max_distance	type:number,	required: true
   * @param options	type:object,	http: optionsFromRequest
   */
  getPathsByReference(blockA, blockB, reference, max_distance, options) {
    console.log('services/auth getPathsByReference', blockA, blockB, reference, max_distance, options);
    return this._ajax('Blocks/pathsByReference', 'GET', {blockA : blockA, blockB : blockB, reference, max_distance, options : options}, true);
  },

  /** 
   */
  featureSearch(featureNames, options) {
    console.log('services/auth featureSearch', featureNames, options);
    return this._ajax('Features/search', 'GET', {filter : featureNames, options}, true);
  },

  createDataset(name) {
    return this._ajax('Datasets', 'POST', JSON.stringify({name: name}), true)
  },

  checkError(data, mapper) {
    // console.log('checkError')
    try {
      if (data.error && data.error[0]) {
        return data.error[0]
      } else if (data.error && data.error.code) {
        let code = data.error.code
        if (mapper[code]) return mapper[code]
        else return code
      } else {
        return false
      }
    } catch (error) {
      console.error(error)
      // may need more sophisticated handling here depending upon
      // type of error
      return error
    }
  },

  _ajax(route, method, data, token) {
    let endpoint = this._endpoint(route) 

    let config = {
      url: endpoint,
      type: method,
      crossDomain: true,
      headers: {},
      contentType: 'application/json'
    }

    if (data) config.data = data

    if (token == true) {
      let accessToken = this._accessToken()
      config.headers.Authorization = accessToken
    } else if (Ember.typeOf(token) == 'string') {
      config.headers.Authorization = token
    }

    return Ember.$.ajax(config)
  },

  _accessToken() {
    let accessToken;
    this.get('session').authorize('authorizer:application', (headerName, headerValue) => {
      accessToken = headerValue;
    });
    return accessToken
  },
  _endpoint(route) {
    let config = Ember.getOwner(this).resolveRegistration('config:environment')
    let endpoint = config.apiHost + '/' + config.apiNamespace + '/' + route
    return endpoint
  }

});
