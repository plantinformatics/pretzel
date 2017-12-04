// module.exports = function(app) {
//   var Role = app.models.Role;

//   // the intent of this resolver is to give availability
//   // of publicised resources to other users on the instance.
//   // another ACL will give write access if it is provided

//   Role.registerResolver('public', function(role, context, cb) {

//     var modelName = context.modelName

//     // Q: Is the current request accessing a Geneticmap or Chromosome?
//     if (modelName !== 'geneticmap' && modelName !== 'chromosome') {
//       // A: No. This role is only for geneticmap or chromosome: callback with FALSE
//       return process.nextTick(() => cb(null, false));
//     }

//     //Q: Is the user logged in? (there will be an accessToken with an ID if so)
//     var userId = context.accessToken.userId;
//     if (!userId) {
//       //A: No, user is NOT logged in: callback with FALSE
//       return process.nextTick(() => cb(null, false));
//     }

//     // separate handling for geneticmap and chromosome models
//     if (modelName == 'geneticmap') {
//       // perform a straight boolean check against the public prop
//     } else if (modelName == 'chromosome') {
//       // gather the geneticmap and check boolean as above
//     }

//     // Q: Is the current logged-in user associated with this Project?
//     // Step 1: lookup the requested project
//     context.model.findById(context.modelId, function(err, project) {
//       // A: The datastore produced an error! Pass error to callback
//       if(err) return cb(err);
//       // A: There's no project by this ID! Pass error to callback
//       if(!project) return cb(new Error("Project not found"));

//       // Step 2: check if User is part of the Team associated with this Project
//       // (using count() because we only want to know if such a record exists)
//       var Team = app.models.Team;
//       Team.count({
//         ownerId: project.ownerId,
//         memberId: userId
//       }, function(err, count) {
//         // A: The datastore produced an error! Pass error to callback
//         if (err) return cb(err);

//         if(count > 0){
//           // A: YES. At least one Team associated with this User AND Project
//           // callback with TRUE, user is role:`teamMember`
//           return cb(null, true);
//         } else {
//           // A: NO, User is not in this Project's Team
//           // callback with FALSE, user is NOT role:`teamMember`
//           return cb(null, false);
//         }
//       });
//     });


//   });
// };