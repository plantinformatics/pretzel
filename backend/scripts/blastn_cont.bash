#!/bin/bash

logFile=~/log/blast/blastn_cont

# dbName is the blastdb name / path within this dir $B
# i.e. cd $B; find . -name \*.ndb -print | sed 's/.ndb$//'
# examples:
#   OUN333/newdir/190509_OUN333_pseudomolecules_V1.00
#   190509_RGT_Planet_pseudomolecules_V1/190509_RGT_Planet_pseudomolecules_V1.fasta
B=/mnt/data_blast/blast/GENOME_REFERENCES
[ -d $B ] || { status=$?; echo 1>&2 "dir $B is not present." $status ; exit $status; }

# $blastnIsInstalled is 0 (true) if blastn is installed locally, otherwise use blast container.
which blastn 2>/dev/null; blastnIsInstalled=$?
# or blastVersion=`blastn -version` ; blastnIsInstalled=$?

echo $PWD, $* >> $logFile
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
if [ -d queries ]
then
  # to pass $fileName to the blast container, copy it into $B which is available to the container as /blast/blastdb/
  queryFile=queries/$(basename $fileName)
  cp -p "$fileName" "$queryFile"
else
  queryFile=$fileName
fi

if [ $blastnIsInstalled -eq 0 ]
then
  blastn  -outfmt '6 std qlen slen' -query  "$queryFile"  -db $B/$dbName
else
  docker run  --rm  -v \
   $B:/blast/blastdb	\
   ncbi/blast blastn	\
   -query  /blast/blastdb/"$queryFile"	\
   -db /blast/blastdb/$dbName	\
   -outfmt '6 std qlen slen'
fi
