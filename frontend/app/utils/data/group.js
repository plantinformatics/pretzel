import { toArrayPromiseProxy } from '../ember-devel';

const groupApi = {
  own :  {primaryModelName : 'groups-own', normalizerName : 'normalizeGroupsOwn'},
  'in' : {primaryModelName : 'client-group', normalizerName : 'normalizeGroupsIn'},
};

/**
 * @param auth  auth / ajax service
 * @param own true/false for groups/own or /in api
 * @param store to push result to
 * @return promise-proxy yielding array of : /in : client-group, /own : group
 */
function getGroups(auth, own, store) {
  const
  apiName = own ? 'own' : 'in',
  config = groupApi[apiName],
  serializer = store.serializerFor(config.primaryModelName),
  /** (proxy) promise yielding an array of records */
  groupsPR = auth.groups(own)
    .then((cgs) => {
      /** result of push is promise, so cgrs is an array of promises yielding records :
       *    in : client-group, own : group
       */
      let cgrs = cgs.map((cg) => {
        let j = serializer[config.normalizerName](cg),
            jr = serializer.store.push(j);
        return jr;
      });
      return Promise.all(cgrs);
    }),
  groups = toArrayPromiseProxy(groupsPR);
  return groups;
}

export {
  getGroups,
}
