#!/bin/bash

# Based on dnaSequenceSearch.bash / dnaSequenceLookup.bash, and about 1/2 the code is common;
# maybe factor to a library script in $resourcesDir/

serverDir=$PWD
# $inContainer is true (0) if running in a container.
[ "$PWD" = / ]; inContainer=$?
case $PWD in
  /)
    # container configuration
    # resourcesDir=$scriptsDir
    resourcesDir=${scriptsDir=/app/lb3app/scripts}
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
unused_var=${bcftools=bcftools}
# or /faidx after blast/
unused_var=${blastDir:=/mnt/data_blast/blast}
unused_var=${vcfDir:=$blastDir/../vcf}
# blastDir=tmp/blast
vcfDir=tmp/vcf
unused_var=${datasetIdDir:=$vcfDir/datasetId}

# Test if running within container.
# File Handles for errors and warnings to be reported back to the user.
# These can be 3,4 when run from backend/common/utilities/child-process.js : childProcess()
# which opens those file handles, but when running from Flask map them to 2 - stderr.
if [ -e /proc/self/fd/3 ]
then
  F_ERR=3
  F_WARN=4
else
  F_ERR=2
  F_WARN=2
fi


logFile=vcfGenotypeLookup.log
(pwd; date; ) >> $logFile
echo $* >> $logFile

# (replace-regexp "\\(.+\\)" "\\1=$\\1,")
echo  \
 inContainer=$inContainer, \
 serverDir=$serverDir, \
 resourcesDir=$resourcesDir, \
 toolsDev=$toolsDev, \
 bcftools=$bcftools, \
 blastDir=$blastDir, \
 vcfDir=$vcfDir, \
 datasetIdDir=$datasetIdDir, \
 >> $logFile



[ -d tmp ] || mkdir tmp

#-------------------------------------------------------------------------------

# Given the argumements to bcftools, other than $parent, are in $*,
# extract the chromosome name, e.g. from "... chr1A ..." set chr="1A"
function chrFromArgs()
{
  chr=$( echo "$*" | sed 's/\(chr..\).*/\1/;s/.*chr//')
}

#-------------------------------------------------------------------------------



set -x
# If running within container then unused args fileName=$1 useFile=$2
# are passed.  If running from Flask server they are not passed.
if [ -e /proc/self/fd/3 ]
then
  fileName="$1"
  useFile="$2"
  parent="$3"
  shift 3
  preArgs="$*"
  echo fileName="$fileName", useFile=$useFile, parent="$parent", preArgs=$preArgs  >> $logFile
else
  parent="$1"
  shift
  preArgs="$*"
  echo parent="$parent", preArgs=$preArgs  >> $logFile
fi
chrFromArgs "$*"



#-------------------------------------------------------------------------------

# this condition is equivalent to $inContainer.
# ls in the container is busybox and does not support -gG.
if ls -l /bin/ls | fgrep -q /bin/busybox
then
    function ll() { ls -l "$@"; }
else
    function ll() { ls -gG "$@"; }
fi

#-------------------------------------------------------------------------------

function dev_result() {
  # copied from dnaSequenceLookup.bash, this could be a VCF/TSV output.
  region=$1
  echo ">$region"
  echo "C"
}

#-------------------------------------------------------------------------------

datasetId=$parent
# Sanitize datasetId. Allow only alphanumeric and -._ and space.
datasetId=$(echo "$datasetId" | sed 's/[^-A-Za-z0-9._ ]/_/g')

# for dataset.tags.vcfDb : $vcfDir/datasetname/chrXX.vcf.gz, chrXX.vcf.gz.csi
# datasetname/ may be a symbolic link;
# If chrXX.vcf.gz.csi is not present it will be created using 'bcftools index'.
# It's name is derived from chrXX.vcf.gz by appending .csi,
# regardless of whether if chrXX.vcf.gz is a symbolic link

# not required for vcf : datasetId2dbName(), $datasetIdDir

# $datasetId is used directly, instead of $(datasetId2dbName ).
dbName="$datasetId"

# This directory check enables dev_result() for dev / loopback test, when blast is not installed.
if false && [ -d ../../pretzel.A1 ]
then
  # sleep 10
  dev_result "$region"
  status=$?
else 
  # (! does not preserve $?, so if that is required, if cd ... ; then : ; else status=$?; echo 1>&$F_ERR "..."; exit $status; fi;  , and equivalent for each if. )
  status=1
  # relative to $vcfDir/$dbName/
  vcfGz="chr$chr.vcf.gz"
  if ! cd "$vcfDir"
  then
    echo 1>&$F_ERR 'Error:' "VCF file is not configured"
  elif ! cd "$dbName"
  then
    echo 1>&$F_ERR 'Error:' "VCF dataset dir is not configured", "$datasetId"
  elif [ ! -f "$vcfGz" ]
    # $vcfGz may be a symbolic link.
    # bash(1) " ... Except for -h and -L, all FILE-related tests dereference symbolic links."
  then
    echo 1>&$F_ERR 'Error:' "VCF file is not configured", "$datasetId", "$chr", "$vcfGz"
  else
    if [ ! -f "$vcfGz".csi ]
    then
      if ! bcftools index "$vcfGz"
      then
        status=$?
        echo 1>&$F_ERR 'Error:' "No index $vcfGz.csi, and failed to build index."
      fi
    fi
    if [ -f "$vcfGz".csi ]
    then
      if ! time "$bcftools" view "$vcfGz" $*
      then
        echo 1>&$F_ERR 'Error:' "Unable to run bcftools view $vcfGz $*"
      else
        status=$?	# 0
      fi
    fi
  fi

fi

# exit $status

#-------------------------------------------------------------------------------