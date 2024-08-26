#!/bin/bash

# @param fileName	fasta file in $logBlastDir/queries/ containing the search query
# @param dbName currently the blast db name, e.g. 190509_RGT_Planet_pseudomolecules_V1.fasta
#  may change to be the parent / reference name.

# precursor of $logBlastDir
# B=/mnt/data_blast/blast/GENOME_REFERENCES/190509_RGT_Planet_pseudomolecules_V1
if [ -d ~/log/. ]
then 
  logDir=~/log
elif [ -d /log ] || mkdir /log
then
  logDir=/log
else
  logDir=.
fi
logBlastDir=$logDir/blast 
[ -d  $logBlastDir ] || mkdir $logBlastDir || exit $?
logFile=$logBlastDir/blastn_request
errorFile=$logDir/blastn.error

set -x
# args : -query "$fileName"  -db "$dbName" -outfmt '6 std qlen slen'
fileName="$2"
dbName="$4"
# currently hard-wired in blastn_cont.bash
# outfmt="$6"

# (pwd; ls -F) >>$logFile
# fileName : dnaSequence is in /, which is the node server cwd.
cd /
# dev testing with : "$B"/queries/"$fileName"
md5=$(md5sum "$fileName"  | cut -c-8)

# $B/queries/ in dev testing
queryDir=$logBlastDir/queries
[ -d "$queryDir" ] || mkdir "$queryDir" || exit
queryFile=$md5.query.fasta
cp -p "$fileName" "$queryDir"/$md5.query.fasta

# $B/results/ in dev testing
resultDir=$logBlastDir/results
[ -d "$resultDir" ] || mkdir "$resultDir" || exit
resultFile="$resultDir/"$(basename $fileName)

# Flask server is on port 4000
# dev testing : localhost
# from feature/blastn_contPy 34652180 in .A3
# Within docker-compose, blastserver will be .3 because it is the 3rd container, so use ip name defined by docker : 'blastserver'
hostIpDefault=$(ip route show | awk '/default/ {print $3}')
unused_var=${hostIp=$hostIpDefault}
unused_var=${FLASK_PORT=4000}
blastnUrl=http://$hostIp:$FLASK_PORT/commands/blastn


# -X POST -H 'Content-Type: application/json' --data-binary
#  -d 
# refn e.g. Eshaan7_Flask-Shell2HTTP.zip:Flask-Shell2HTTP-master/examples/multiple_files.py,
# and https://flask.palletsprojects.com/en/1.1.x/api/#flask.Request.files
# , \"'"$dbName"'\"
cd "$queryDir"
# -s / --silent suppresses error messages, whereas --no-progress-meter suppresses just the progress-meter
if curl --no-progress-meter 2>$errorFile  >"$resultFile".whole  -F "$queryFile"=@"$queryFile" -F request_json='{"args": ["'@"$queryFile"'", "'"$dbName"'"]}' $blastnUrl
then
  result_url=$(< "$resultFile".whole  tee -a $logFile | jq ".error // .result_url")
else
  echo -n 'Error:'; cat "$errorFile"
  (echo first status=$status; cat "$errorFile") >>$logFile
  exit $status
fi

case $result_url in
  *' already exists'*)
    # 2nd line is "null"
    # $blastnUrl contains / etc.
    result_url="$blastnUrl?key=$(echo $result_url | sed -n "s/.*future_key \(.*\) already exists.*/\1/p")"
    ;;
  null|'')
    # error return : result_url=null
    (echo status=1; cat "$errorFile") >>$logFile
    exit 1
    ;;
  *)
    # Result has surrounding "", so remove these
    eval result_url=$result_url
    ;;
esac


# timeout after 2 min (24  * 5sec)
# blast can take minutes - may increase this (have used 40; it delays failure which can slow devel)
for i in $(yes ' ' | head -24 | cat -n)
do
  # Without  --raw-output, the .report string is wrapped with "" and has \t
  # First result may be : {"key":"60a3ec3c","status":"running"}. length of "running\n" is 8
  status=0
  if curl --no-progress-meter $result_url 2>$errorFile > "$resultFile".whole
  then
    < "$resultFile".whole  jq --raw-output ".report // .status" > "$resultFile"
    if [ \! -s "$resultFile" ] || [ "$(ls -ld  "$resultFile" | awk ' {print $5;}')" -eq 8 ]
    then
      sleep 5
    else
      # Trace number of seconds waited, i.e. delay * time steps.
      expr 5 \* $i 1>&2
      # If .error field is not empty, output it prefixed with 'Error:'
      # ls -lArtF $resultDir  >>$logFile
      # < "$resultFile".whole jq --raw-output .error  >>$logFile
      < "$resultFile".whole jq --raw-output .error | sed '/^$/d'  > "$resultFile".error
      if [ -s "$resultFile".error ]
      then
        echo -n 'Error:'; cat "$resultFile".error
      fi
      sed '/^running$/d' "$resultFile"
      status=$?
      (echo done status=$status; cat "$errorFile") >>$logFile
      exit $status
    fi
    
  else
    status=$?
    echo -n 'Error:'; cat "$errorFile"
    (echo error status=$status; cat "$errorFile") >>$logFile
    exit $status
  fi
done

# final output has :
#   success : 'returncode': 0, 'error': '', 'report': 'WAPO1\tchr7A\t100.000\t183\t0\t0\t1\t183\...'   (for example)
#   failure : 'returncode': 1, 'report': '', "error": "dir /mnt/data_blast/blast/datasetId is not present. 1\n", (for example)
# 'status' field is not present in final output, only in "running"

# output
# 127.0.0.1 - - [18/May/2021 06:26:25] "POST /commands/blastn HTTP/1.1" 202 -
# {"key":"ff15c90f","result_url":"http://localhost:4000/commands/blastn?key=ff15c90f","status":"running"}
# {} {'key': 'ff15c90f', 'report': 'BobWhite_c10015_641\tchr2H\t100.000\t50\t0\t0\t1\t50\t139120279\t139120328\t7.70e-18\t93.5\t50\t672273650\n', 'error': '', 'returncode': 0, 'start_time': 1621319185.12147, 'end_time': 1621319208.0651033, 'process_time': 22.943633317947388}
