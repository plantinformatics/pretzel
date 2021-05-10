#!/bin/bash

case $PWD in
  /)
    resourcesDir=/app/scripts
    toolsDev=$resourcesDir
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
addDataset=$6
echo fileName="$fileName", useFile=$useFile, parent="$parent", searchType=$searchType, resultRows=$resultRows, addDataset=$addDataset  >> $logFile


#-------------------------------------------------------------------------------

if ls -l /bin/ls | fgrep -q /bin/busybox
then
    function ll() { ls -l $*; }
else
    function ll() { ls -gG $*; }
fi

#-------------------------------------------------------------------------------

function dev_blastResult() {
# Convert spaces to \t
unexpand -t 8 <<\EOF
BobWhite_c10015_641     chr2A   100.000 50      0       0       1       50      154414057       154414008       2.36e-17        93.5    50      780798557
BobWhite_c10015_641     chr2B   98.000  50      1       0       1       50      207600007       207600056       1.10e-15        87.9    50      801256715
EOF
}

#-------------------------------------------------------------------------------
datasetId=Triticum_aestivum_IWGSC_RefSeq_v1.0

#echo ">BobWhite_c10015_641
# AGCTGGGTGTCGTTGATCTTCAGGTCCTTCTGGATGTACAGCGACGCTCC" | 

fileName=/home/ec2-user/pretzel/"$fileName"

datasetIdDir=/mnt/data_blast/blast/datasetId

# Enable this to use dev_blastResult() for dev / loopback test, when blast is not installed.
if false
then
  dev_blastResult |	\
      ( [ -n "$resultRows" ] && head -n $resultRows || cat)
  status=$?
else 
  # fastafile.fa

  # (! does not preserve $?, so if that is required, if cd ... ; then : ; else status=$?; echo 1>&3 "..."; exit $status; fi;  , and equivalent for each if. )
  status=1
  if ! cd "$datasetIdDir"
  then
    echo 1>&3 'Error:' "Blast Database is not configured"
  elif ! dbName="$datasetId".dir/$(cat "$datasetId".dbName)
  then
    echo 1>&3 'Error:' "Blast datasetId is not configured", "$datasetId"
  elif ! time blastn  -query "$fileName"  -db "$dbName" -outfmt '6 std qlen slen' |	\
      ( [ -n "$resultRows" ] && head -n $resultRows || cat)
  then
    echo 1>&3 'Error:' "Unable to run Blast"
  else
    status=$?	# 0
  fi

fi

# exit $status

#-------------------------------------------------------------------------------
