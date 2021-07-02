#!/bin/bash

# dbName is the blastdb name / path within this dir $B
# i.e. cd $B; find . -name \*.ndb -print | sed 's/.ndb$//'
# examples:
#   OUN333/newdir/190509_OUN333_pseudomolecules_V1.00
#   190509_RGT_Planet_pseudomolecules_V1/190509_RGT_Planet_pseudomolecules_V1.fasta
B=/mnt/data_blast/blast/GENOME_REFERENCES
cd $B || exit $?

echo $* >> ~/log/blast/blastn_cont
# fileName is e.g. /tmp/tmpo4kfn__8/cbf064c0.query.fasta
fileName=$1
dbName=$2
# dbName is required arg (now passed OK), so report error and fail if undefined
if [ -z "$dbName" ]
then
  msg="$0 : required arg dbName is empty string"
  echo "$msg"  >> ~/log/blast/blastn_cont
  echo "$msg" 1>&2
  exit 1
fi

# blastServer.query.fasta
queryFile=queries/$(basename $fileName)
cp -p "$fileName" "$queryFile"
# cat > 

docker run  --rm  -v \
 $B:/blast/blastdb	\
 ncbi/blast blastn	\
 -query  /blast/blastdb/"$queryFile"	\
 -db /blast/blastdb/$dbName	\
 -outfmt '6 std qlen slen'
