#!/bin/bash

# Usage :
#  source ~/scripts/logDateTime.bash
#  source ~/scripts/mongo_admin.bash

dbCollections()
{
    if [ -z "$DIM" ];
     then 
	 echo DIM : Docker identity of Mongo Instance is required
	 return 1
    else
	docker exec -it $DIM mongo --quiet admin --eval "db.getCollectionNames()" | tr -d '[\[\]",\t ]' | tr '\r' ' '
    fi
}


function mongodump2S3()
{
  logDate=`date +%Y%b%d`
  echo $logDate
  # 2018Sep26
  export S3_MON="s3://shared-data-4pretzel/mongodb/main.admin/$logDate"
  echo $S3_MON
  collections=$(dbCollections )
  echo $collections
  sleep 5

  # AccessToken Alias Block Client Dataset Feature 
  for i in $collections; do echo $i; time docker exec -it $DIM mongodump  --db admin --collection $i; done

  docker exec -i -e TERM=$TERM $DIM bash -c 'cd /dump/; tar zcf - admin' | aws s3 cp -  $S3_MON.tar.gz	\
  && aws s3 ls $S3_MON.tar.gz	\
  && docker exec -i -e TERM=$TERM $DIM bash -c 'rm -r /dump/admin'
}
