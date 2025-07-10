#!/bin/bash

#-------------------------------------------------------------------------------

# Usage :
#  source ~/scripts/logDateTime.bash
#  source ~/scripts/mongo_admin.bash

#-------------------------------------------------------------------------------

unused=${SERVER_NAME=main}
# Using pretzel in place of admin in new instances.
unused=${DB_NAME=admin}
# For mongo shell either by running a binary direcly, or via docker exec.
# copied from pretzel/resources/tools/dev/functions_data.bash
# related : mongoShell()
unused=${dockerExec="docker exec $DIM"}
# DIM is the ID of the docker mongo container,
# defined by pretzel/resources/tools/functions_prod.bash : DIM=$(dockerContainer mongo)

#-------------------------------------------------------------------------------

function database_ip() {
  di_DIM=$1;
  docker inspect $di_DIM --format '{{ (index  .NetworkSettings.Networks "pretzel-prod_pretzel-prod").IPAddress }}'
}

#-------------------------------------------------------------------------------



# from mongo_admin.2025Jun.bash

logDate=$(date +%Y%b%d);
echo logDate=$logDate

echo DIM=$DIM

DB_HOST=$(database_ip $DIM)
echo DB_HOST=$DB_HOST


#-------------------------------------------------------------------------------

checkDIM()
{
    if [ -n "$DIM" ];
     then 
       status=$?
    else
       status=$?
       echo DIM : Docker identity of Mongo Instance is required
    fi
    return $status
}
dbCollections()
{
    checkDIM &&
      docker exec -it $DIM mongo --quiet $DB_NAME --eval "db.getCollectionNames()" | tr -d '[\[\]",\t ]' | tr '\r' ' '
}


function mongodump2S3()
{
  logDate=`date +%Y%b%d`
  echo $logDate
  # 2018Sep26
  export S3_MON="s3://shared-data-4pretzel/mongodb/$SERVER_NAME.$DB_NAME/$logDate"
  echo $S3_MON
  collections=$(dbCollections )
  echo $collections
  sleep 5

  docker exec -i $DIM mongodump  --archive --gzip --db $DB_NAME  | aws s3 cp -  $S3_MON.gz	\
  && aws s3 ls $S3_MON.tar.gz
}

#-------------------------------------------------------------------------------


# Output a list of signups, from the Client collection.
#
# @param 1	emailVerified : true or false, true matches if emailVerified exists in the Client record, false matches if it does not exist
# default value : false.
# This param can be provided via environment variable :
# emailVerified=false signupList
# or : signupList false
function signupList()
{
    if [ $# -gt 0 ]
    then
       emailVerified=$1
    fi
    unused=${emailVerified=false}

    checkDIM &&
      docker exec -i $DIM mongo --host $DB_HOST --quiet $DB_NAME <<EOF
db.Client.aggregate( [
  { \$match : { emailVerified: { \$exists: $emailVerified }} },
  { \$project: { _id: 0, signUp : {\$dateToString:{date:{\$toDate:"\$_id"}, format:"%Y-%m-%d %H:%M:%S %z", timezone : 'Australia/Melbourne'}}, email : 1, name : 1, institution : 1, project : 1, emailVerified : 1 } }
]).forEach(printjson)
EOF
# or DBQuery.shellBatchSize = 1000
}
function signupReport()
{
  echo -e 'Email\tName\tInstitution\tProject\tSignUp'
  signupList | jq -r 'map(.)  | @tsv'
}


#-------------------------------------------------------------------------------

function signupReports() {

  cd ~/log/agg_signupReport

  signupReport > agg_unverified.$logDate.tsv
  head -1 agg_unverified.$logDate.tsv
  tail -5 agg_unverified.$logDate.tsv

  emailVerified=true signupReport > agg_verified.$logDate.tsv
  head -1 agg_verified.$logDate.tsv
  tail -5 agg_verified.$logDate.tsv
}


verifySignup() {
  email=$1
  docker exec -i $DIM mongo --host $DB_HOST --quiet $DB_NAME <<EOF
db.Client.find ( {email : "$email"})
db.Client.updateOne ( {email : "$email"}, { \$set: {"emailVerified" : true} } )
EOF
}


#-------------------------------------------------------------------------------

function getIndexes()
{
  for ma_collection in Feature Alias
  do
    echo $ma_collection
    mongoShell '' --quiet ${DB_NAME-admin} --eval "db.$ma_collection.getIndexes()"
  done
}


function createIndexes()
{
  mongoShell '' --quiet ${DB_NAME-admin} --eval \
"db.Alias.createIndex ( {namespace1:1, namespace2:1, string1:1, string2:1} );
db.Feature.createIndex({blockId:1, value_0:1});
db.Feature.createIndex({name:1} );"
}
# localise-aliases.js : remoteNamespacesGetAliases() : getAliases() could use this index :
#   db.Alias.createIndex ( {namespace1:1, namespace2:1} )
# That is covered by the index ( {namespace1:1, namespace2:1, string1:1, string2:1} )

#-------------------------------------------------------------------------------
