#!/bin/bash

serverDir=$PWD
# $inContainer is true (0) if running in a container.
[ "$PWD" = / ]; inContainer=$?
case $PWD in
  /)
    # container configuration
    resourcesDir=/app/scripts
    toolsDev=$resourcesDir
    blastn=$resourcesDir/blastn_request.bash
    datasetIdDir=$resourcesDir/blast/datasetId
    ;;
  *backend)
    resourcesDir=../resources
    ;;
  *)
    resourcesDir=resources
    ;;
esac
# Default value of toolsDev, if not set above.
unused_var=${toolsDev=$resourcesDir/tools/dev}
unused_var=${blastn=blastn}
unused_var=${datasetIdDir=/mnt/data_blast/blast/datasetId}


sp=$toolsDev/snps2Dataset.pl

logFile=dnaSequenceSearch.log
(pwd; date; ) >> $logFile
echo $* >> $logFile

[ -d tmp ] || mkdir tmp

set -x
fileName=$1
useFile=$2
parent=$3
searchType=$4
resultRows=$5
# addDataset is 'true' or 'false'
addDataset=$6
datasetName=$7
echo fileName="$fileName", useFile=$useFile, parent="$parent", searchType=$searchType, resultRows=$resultRows, addDataset=$addDataset, datasetName=$datasetName  >> $logFile


#-------------------------------------------------------------------------------

if ls -l /bin/ls | fgrep -q /bin/busybox
then
    function ll() { ls -l "$@"; }
else
    function ll() { ls -gG "$@"; }
fi

#-------------------------------------------------------------------------------

function dev_blastResult() {
  devResultDir=${pA-${HOME-/home/don}/new/projects/agribio}/data/wheat/fasta/blast_result
  if [ $# -eq 1 -a -d $devResultDir ]
  then
    cat $devResultDir/$1
  else
# Convert spaces to \t
# unexpand does not alter single spaces, so use sed to map those.
# lines 3-4 are modified copies of 1-2, to provide multiple features on an axis. (start +1 for unique location)
unexpand -t 8 <<\EOF | sed "s/ /\t/"
BobWhite_c10015_641     chr2A   100.000 50      0       0       1       50      154414057       154414008       2.36e-17        93.5    50      780798557
BobWhite_c10015_641     chr2B   98.000  50      1       0       1       50      207600007       207600056       1.10e-15        87.9    50      801256715
BobWhite_c10015_641     chr2A   100.000 50      0       0       1       50      207600008       207600056       2.36e-17        93.5    50      780798557
BobWhite_c10015_641     chr2B   98.000  50      1       0       1       50      154414058       154414008       1.10e-15        87.9    50      801256715
EOF
fi
}

#-------------------------------------------------------------------------------

columnHeaders=$(echo "query ID, subject ID, % identity, length of HSP (hit), n mismatches, n gaps, query start, query end, subject start, subject end, e-value, score, query length, subject length" | sed "s/, /\t/g")

function convertSearchResults2Json()
{
  cd $serverDir
  tsv=tmp/"$datasetName".tsv
  out=tmp/"$datasetName".json

  parentName="$parent"
  platform=$searchType		# maybe

  datasetNameFull="$parentName.$datasetName"
  nameArgs=(-d "$datasetNameFull" -p "$parentName" -n"$parentName:$platform")


  export columnsKeyString='name chr pcIdentity lengthOfHspHit numMismatches numGaps queryStart queryEnd pos end'
  # /dev/fd/2
  (echo "$columnHeaders"; \
   tee "$tsv" |	\
     sort -t$'\t' -k 2 ) |  \
    $sp -H -F$'\t' "${nameArgs[@]}"  	\
	   >  "$out"
  ll "$out"  >> $logFile;
  # upload() will read $out
  # caller knows the filename and datasetName, so probably won't need
  # this (as is done in uploadSpreadsheet.bash) :
  # echo "tmp/$out;$datasetNameFull"
  cat "$tsv"
}

#-------------------------------------------------------------------------------

datasetId=$parent

#echo ">BobWhite_c10015_641
# AGCTGGGTGTCGTTGATCTTCAGGTCCTTCTGGATGTACAGCGACGCTCC" | 

if [ $inContainer -ne 0 ]
then
  fileName=/home/ec2-user/pretzel/"$fileName"
fi

function datasetId2dbName()
{
  if [ $inContainer -eq 0 ]
  then
    dbName=$(cat "$datasetId".dbName)
  else
    dbName="$datasetId".dir/$(cat "$datasetId".dbName)
  fi
  echo "$dbName"
  cd $serverDir
}

# This directory check enables dev_blastResult() for dev / loopback test, when blast is not installed.
if [ -d ../../pretzel.A1 ]
then
  # sleep 10
  # FJ039903.1, DQ146423.1
  dev_blastResult "$datasetId" |	\
      ( [ "$addDataset" = true ] && convertSearchResults2Json || cat) |	\
      ( [ -n "$resultRows" ] && head -n $resultRows || cat)
  status=$?
else 
  # fastafile.fa

  # (! does not preserve $?, so if that is required, if cd ... ; then : ; else status=$?; echo 1>&3 "..."; exit $status; fi;  , and equivalent for each if. )
  status=1
  if ! cd "$datasetIdDir"
  then
    echo 1>&3 'Error:' "Blast Database is not configured"
  elif ! dbName=$(datasetId2dbName "$datasetId")
  then
    echo 1>&3 'Error:' "Blast datasetId is not configured", "$datasetId"
  elif ! time $blastn  -query "$fileName"  -db "$dbName" -outfmt '6 std qlen slen' |	\
      ( [ "$addDataset" = true ] && convertSearchResults2Json || cat) |	\
      ( [ -n "$resultRows" ] && head -n $resultRows || cat)
  then
    echo 1>&3 'Error:' "Unable to run Blast"
  else
    status=$?	# 0
  fi

fi

# exit $status

#-------------------------------------------------------------------------------
