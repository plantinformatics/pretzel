#!/bin/bash

#-------------------------------------------------------------------------------

# Usage :
#  source ~/scripts/logDateTime.bash
#  source ~/scripts/mongo_admin.bash

#-------------------------------------------------------------------------------

unused=${SERVER_NAME=main}

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
	docker exec -it $DIM mongo --quiet admin --eval "db.getCollectionNames()" | tr -d '[\[\]",\t ]' | tr '\r' ' '
}


function mongodump2S3()
{
  logDate=`date +%Y%b%d`
  echo $logDate
  # 2018Sep26
  export S3_MON="s3://shared-data-4pretzel/mongodb/$SERVER_NAME.admin/$logDate"
  echo $S3_MON
  collections=$(dbCollections )
  echo $collections
  sleep 5

  docker exec -i $DIM mongodump  --archive --gzip --db admin  | aws s3 cp -  $S3_MON.gz	\
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
	docker exec -i $DIM mongo --quiet admin <<EOF
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
