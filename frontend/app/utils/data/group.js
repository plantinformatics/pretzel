import { toArrayPromiseProxy } from '../ember-devel';

const groupApi = {
  own :  {primaryModelName : 'groups-own', normalizerName : 'normalizeGroupsOwn'},
  'in' : {primaryModelName : 'groups-in', normalizerName : 'normalizeGroupsIn'},
};

/**
 * @param auth  auth / ajax service
 * @param own true/false for groups/own or /in api
 * @param server  to request from; server.store to push result to
 * @return promise yielding array of records : /in : client-group, /own : group
 */
function getGroups(auth, own, server) {
  const
  store = server.store,
  apiName = own ? 'own' : 'in',
  config = groupApi[apiName],
  serializer = store.serializerFor(config.primaryModelName),
  /** promise yielding an array of records */
  groupsPR = auth.groups(server, own)
    .then((cgs) => {
      /** result of push is record, so cgrs is an array of records :
       *    in : client-group, own : group
       */
      let cgrs = cgs.map((cg) => {
        let j = serializer[config.normalizerName](cg),
            jr = serializer.store.push(j);
        return jr;
      });
      return cgrs;
    }),
  groups = groupsPR;
  return groups;
}

export {
  getGroups,
}
