#!/bin/bash

logFile=~/log/blast/blastn_cont

# dbName is the blastdb name / path within this dir $B
# i.e. cd $B; find . -name \*.ndb -print | sed 's/.ndb$//'
# examples:
#   OUN333/newdir/190509_OUN333_pseudomolecules_V1.00
#   190509_RGT_Planet_pseudomolecules_V1/190509_RGT_Planet_pseudomolecules_V1.fasta

echo fileName,dbName=$* >> $logFile
echo blastDir=$blastDir, mntData=$mntData  >> $logFile
unused_var=${blastDir:=${mntData:=/mnt/data}/blast}
case "$2" in
  *.dir/*)
    B_suffix=datasetId
    B=$blastDir/datasetId
    ;;
  *)
    B_suffix=GENOME_REFERENCES
    B=$blastDir/GENOME_REFERENCES
    ;;
esac
[ -d $B ] || { status=$?; echo 1>&2 "dir $B is not present." $status ; exit $status; }

# $blastnIsInstalled is 0 (true) if blastn is installed locally, otherwise use blast container.
which blastn 2>/dev/null 1>/dev/null; blastnIsInstalled=$?
# or blastVersion=`blastn -version` ; blastnIsInstalled=$?

echo PWD=$PWD, fileName,dbName=$*, blastDir=$blastDir, B_suffix=$B_suffix >> $logFile
# fileName is e.g. /tmp/tmpo4kfn__8/cbf064c0.query.fasta
fileName=$1
dbName=$2
# dbName is required arg (now passed OK), so report error and fail if undefined
if [ -z "$dbName" ]
then
  msg="$0 : required arg dbName is empty string"
  echo "$msg"  >> $logFile
  echo "$msg" 1>&2
  exit 1
fi

# if not $blastnIsInstalled, then queries/ should be configured.
if [ $blastnIsInstalled -eq 0 ]
then
  queryFile=$fileName
else
  # to pass $fileName to the blast container, copy it into $blastDir which is available to the container as /blast/blastdb/
  queries=$( [[ -d queries ]] && echo queries || ( ( [[ -d $blastDir/queries ]] ||  mkdir $blastDir/queries  ) && echo queries ) )
  queryFile=$queries/$(basename $fileName)
  # copy in $blastDir is used; copy in $B may not be.
  cp -p "$fileName" "$B/$queryFile"
  cp -p "$fileName" "$blastDir/$queryFile"
fi
echo blastnIsInstalled=$blastnIsInstalled, queries=$queries, $fileName="$fileName" queryFile="$queryFile" >> $logFile

if [ $blastnIsInstalled -eq 0 ]
then
  echo blastn  -outfmt '6 std qlen slen' -query  "$queryFile"  -db $B/$dbName  >> $logFile
  blastn  -outfmt '6 std qlen slen' -query  "$queryFile"  -db $B/$dbName
else
  docker run  --rm  -v \
   $blastDir:/blast/blastdb	\
   ncbi/blast blastn	\
   -query  /blast/blastdb/"$queryFile"	\
   -db /blast/blastdb/$B_suffix/$dbName	\
   -outfmt '6 std qlen slen'
fi
