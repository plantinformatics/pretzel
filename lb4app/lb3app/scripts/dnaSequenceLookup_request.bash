#!/bin/bash

# called from @see backend/common/models/block.js : Block.dnaSequenceLookup()
# not used :
# @param fileName	false
# @param useFile	undefined
# used :
# @param parent	(dbName)
# @param region

# @param dbName currently the blast db name, e.g. 190509_RGT_Planet_pseudomolecules_V1.fasta
#  may change to be the parent / reference name.

# based on blastn_cont.bash


if [ -d ~/log ]
then 
  logDirRoot= ~/log
elif [ -d /log ] || mkdir /log
then
  logDirRoot=/log
else
  logDirRoot= .
fi
logDir=$logDirRoot/dnaSequenceLookup 
[ -d  $logDir ] || mkdir $logDir || exit $?
logFile=$logDir/dnaSequenceLookup_request

set -x
#fileName=$1
#useFile=$2

dbName="$3"
region="$4"

(pwd; echo "ARGS:$*"; ls -F) >>$logFile

# Flask server is on port 4000
# dev testing : localhost
hostIp=$(ip route show | awk '/default/ {print $3}')
requestUrlBase=http://$hostIp:4000/commands/dnaSequenceLookup

# cd "$queryDir"
# -F request_json= is used in blastn_request.bash because it is multi-file (sends queryFile as well as args).
result_url=$(curl -s -H 'Content-Type: application/json' -d '{"args": ["'"$dbName"'", "'"$region"'" ]}' $requestUrlBase | tee -a $logFile | jq ".error // .result_url")
case $result_url in
  *' already exists'*)
    # 2nd line is "null"
    # $requestUrlBase contains / etc.
    result_url="$requestUrlBase?key=$(echo $result_url | sed -n "s/.*future_key \(.*\) already exists.*/\1/p")"
    ;;
  *)
    # Result has surrounding "", so remove these
    eval result_url=$result_url
    ;;
  null)
    # error return : result_url=null
    exit 1
esac

# $B/results/ in dev testing
resultDir=$logDir/results
[ -d "$resultDir" ] || mkdir "$resultDir" || exit
resultFile="$resultDir/$dbName.$region.fa"
# timeout after 2 min (24  * 5sec)
# samtools faidx takes only a few secs
# As required, the first request will build the index, which takes ~10sec
for i in $(yes ' ' | head -24 | cat -n)
do
  # Without  --raw-output, the .report string is wrapped with "" and has \t
  # First result may be : {"key":"60a3ec3c","status":"running"}. length of "running\n" is 8
  if curl -s $result_url | tee "$resultFile".whole | jq --raw-output ".report // .status" > "$resultFile"  && [ \! -s "$resultFile" ] || [ "$(ls -ld  "$resultFile" | awk ' {print $5;}')" -eq 8 ] ;
  then
    sleep 5
  else
    # Trace time steps while waiting.
    expr 5 \* $i 1>&2
    sed '/^running$/d' "$resultFile"
    exit $?
  fi
done
