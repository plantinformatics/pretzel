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

#-------------------------------------------------------------------------------

if ls -l /bin/ls | fgrep -q /bin/busybox
then
    function ll() { ls -l $*; }
else
    function ll() { ls -gG $*; }
fi

#-------------------------------------------------------------------------------

dev_blastResult=$(cat <<\EOF
BobWhite_c10015_641     chr2A   100.000 50      0       0       1       50      154414057       154414008       2.36e-17        93.5    50      780798557
BobWhite_c10015_641     chr2B   98.000  50      1       0       1       50      207600007       207600056       1.10e-15        87.9    50      801256715
EOF
)

#-------------------------------------------------------------------------------
datasetId=Triticum_aestivum_IWGSC_RefSeq_v1.0

#echo ">BobWhite_c10015_641
# AGCTGGGTGTCGTTGATCTTCAGGTCCTTCTGGATGTACAGCGACGCTCC" | 

fileName=/home/ec2-user/pretzel/"$fileName"

# For dev / loopback test, when blast is not installed.
if false
then
  echo $dev_blastResult
else 
  # fastafile.fa
  cd /mnt/data_blast/blast/datasetId
  time blastn  -query $fileName  -db "$datasetId".dir/$(cat "$datasetId".dbName) -outfmt '6 std qlen slen'
  #  >> $logFile
fi


#-------------------------------------------------------------------------------
