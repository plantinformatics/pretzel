#!/bin/bash

#-------------------------------------------------------------------------------

# Usage :
#  source ~/scripts/logDateTime.bash ? not needed - definition of logDate is copied into this file.
#  source mongo_admin.bash
#
#-------------------------------------------------------------------------------
#
# Required environment variables, example values :
# export DIM=docker-compose-database-1
# database_ip=$( docker inspect $DIM --format '{{ (index  .NetworkSettings.Networks "'docker-compose_pretzel'").IPAddress }}' )
# db_connection=(--host $database_ip --port 28017 )
# echo db_connection ${db_connection[@]}
# export DB_NAME=pretzel   # or admin
# mAuth=-u ... -p ...  --authenticationDatabase  ...
# db_connection and mAuth may be undefined.
#-------------------------------------------------------------------------------



unused=${SERVER_NAME=main}
# Using pretzel in place of admin in new instances.
unused=${DB_NAME=admin}
# For mongo shell either by running a binary directly, or via docker exec.
# copied from pretzel/resources/tools/dev/functions_data.bash
# related : mongoShell()
unused=${dockerExec="docker exec $DIM"}
# DIM is the ID of the docker mongo container,
# defined by pretzel/resources/tools/functions_prod.bash : DIM=$(dockerContainer mongo)

# Directory in bucket to write mongodump to
unused=${S3_MONGO=s3://shared-data-4pretzel/mongodb}
export S3_MONGO

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
      docker exec -it $DIM mongo --quiet ${db_connection[@]} ${mAuth[@]} $DB_NAME \
      --eval "db.getCollectionNames()" | tr -d '[\[\]",\t ]' | tr '\r' ' '
}


# mongodump the database to S3, for backup.
#
# @param environment variable $logDate, used in output file name,
# if = Day, then use weekday name.
# The default logDate is YYMMDD_HHMMSS.
function mongodump2S3()
{
  # if 'Day' then use abbreviated weekday name (3-letter)
  # so that logs wrap around weekly.
  # (copied from mongo_backup.sh)
  if [ "$logDate" = Day ]
  then
    logDate=$(date +%a)
  elif [ -z "$logDate" ]
  then
    logDate=$(date +%Y%m%d_%H%M%S)
    # or logDate=`date +%Y%b%d`
  fi
  echo $logDate
  # 2018Sep26
  # Within mongo directory in S3 bucket, a directory for this server.
  export S3_MONGO_SERV=$S3_MONGO/$SERVER_NAME.$DB_NAME
  export S3_MON="$S3_MONGO_SERV/$logDate"
  echo $S3_MON
  collections=$(dbCollections )
  echo $collections
  sleep 5

  docker exec -i $DIM mongodump ${db_connection[@]}  ${mAuth[@]} --db $DB_NAME  \
   --archive --gzip  | aws s3 cp -  $S3_MON.gz	\
  && aws s3 ls "$S3_MONGO_SERV/" # $S3_MON.tar.gz
  # or maybe aws s3api head-object --bucket bucket-name --key path-name
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
