#!/bin/bash

B=/mnt/data_blast/blast/GENOME_REFERENCES/190509_RGT_Planet_pseudomolecules_V1
cd $B || exit $?

echo $* >> ~/log/blast/blastn_cont
# fileName is e.g. /tmp/tmpo4kfn__8/cbf064c0.query.fasta
fileName=$1
dbName=$2
# currently a problem with passing this arg, so it is hard-wired.
if [ -z "$dbName" ]
then
  dbName=190509_RGT_Planet_pseudomolecules_V1.fasta
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
