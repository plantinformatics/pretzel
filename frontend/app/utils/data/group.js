import { toArrayPromiseProxy } from '../ember-devel';

// -----------------------------------------------------------------------------

const dLog = console.debug;

// -----------------------------------------------------------------------------


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
function getGroups(auth, own, server, apiServers) {
  const
  store = server.store,
  apiName = own ? 'own' : 'in',
  config = groupApi[apiName],
  serializer = store.serializerFor(config.primaryModelName),
  /** promise yielding an array of records */
  groupsPR = own ? getGroups2(auth, own, server, apiServers) :
    auth.groups(server, own)
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

function getGroups2(auth, own, server, apiServers) {
  const
  fnName = 'getGroups2',
  store = server.store,
  clientId = server.clientId,
  filter = {where : {clientId}, include : 'clientGroups'},
  adapterOptions = apiServers.addId(server, { filter }),
  groupsP = store.query('group', adapterOptions, {adapterOptions : {host : server.name}})
    .then((groups) => {
      dLog(fnName, groups);
      /* query() does push(). refn : @ember-data/store/-private.js : _query() :
       * var internalModels = store._push(payload);
       */
      return groups.toArray();
    })
    .catch((error) => {dLog(fnName, error); return [];});
  return groupsP;
}

// -----------------------------------------------------------------------------

/** The result of groups/in is an array of client-groups; map from this to an
 * array of the corresponding groups.
 *
 * cgs[i] is model:client-group, cgs[i].get('groupId') is Proxy, so use .content to get model:group
 */
function clientGroupsToGroups(cgs) {
  /** API lookup failure for a groupId leads to g.name undefined here.
   * E.g. this user may not be a member of the dataset group, and hence
   * the API lookup is not permitted.
   * The pull-down contains only groups which this user is a member of.
   * Will also filter out non-existent groupId from groups/in
   */
  let gs = cgs.mapBy('groupId.content')
      .filter((g) => g.name);
  return gs;
}

// -----------------------------------------------------------------------------

/**
 * @return a promise, yielding the record of the deleted ClientGroup, or
 * throwing a text error message derived from the API error.
 * @param clientGroup, clientGroupId.
 * Originally clientGroup was found from clientGroupId in controllers/group/edit.js;
 * Now, in both uses : clientGroupId is now clientGroup.id
 */
function removeGroupMember(apiServers, server, clientGroup, clientGroupId) {
  let
  fnName = 'removeGroupMember',
  adapterOptions = apiServers.addId(server, { }), 

  destroyP = clientGroup.destroyRecord(adapterOptions);

  destroyP.then((cg) => {
    // expect API response is {count : 1}
    dLog(
      fnName, 'done', clientGroupId, 
      cg.id,
      'groupId', cg.get('groupId.id'),
      'clientId.id', cg.get('clientId.id'),
      'clientId.email', cg.get('clientId.email'),
      'groupId.clientId', cg.get('groupId.clientId.id'));

    return cg;
  })
    .catch((error) => {
      let
      e = error?.errors[0],
      statusCode = e.status,
      /** the GUI won't send a request which would cause 403. */
      detail = (statusCode === '403') ? 'Only group owner / admin can remove members' :
        (statusCode === '409') ? 'Data error' : undefined,
      derivedText = detail || error.message || error;
      dLog(fnName, 'error', error, clientGroupId);
      throw derivedText;
    });

  return destroyP;
}

// -----------------------------------------------------------------------------

/** request the datasets of the given groupId.
 */
function groupDatasets(apiServers, server, store, groupId) {
  const
    filter = {include: 'group', where : {groupId}},

    /** associate the server with the adapterOptions, used by
     *   adapters/application.js : buildURL().
     * as in :
     *   services/data/dataset.js : taskGetList(), getData()
     *   services/data/block.js : getData()
     */
    adapterOptions = apiServers.addId(server, { filter }), 

    datasetsP = store.query('dataset', adapterOptions);

    datasetsP.then(function(datasets) {
      dLog('datasets', datasets.toArray());
    });
    return datasetsP;
}

// -----------------------------------------------------------------------------

export {
  getGroups,
  clientGroupsToGroups,
  removeGroupMember,
  groupDatasets,
}

// -----------------------------------------------------------------------------
