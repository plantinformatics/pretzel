#!/bin/bash

# Based on dnaSequenceSearch.bash / dnaSequenceLookup.bash, and about 1/2 the code is common;
# maybe factor to a library script in $resourcesDir/

# called from : common/utilities/vcf-genotype.js : vcfGenotypeLookup()

# optional - passed when called via 
# @param fileName
# @param useFile
# Required :
# @param command	query | view | isec
# @param datasetIdParam - names of VCF datasets, i.e. 1 or more datasetId, joined with !; 
# where datasetId is a datablock not a reference / parent.
# This is split into the array datasetIds.
# @param scope		chromosome name, e.g. 1A
# @param preArgs	remaining args : $*

#  args to bcftools other than command vcfGz; named preArgs because they could
#  be inserted between command and vcfGz arguments to bcftools.


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
# unused_var=${vcfDir:=$blastDir/../vcf}
# blastDir=tmp/blast
set -x
vcfDir=tmp/vcf
if [ ! -e "$vcfDir" -a -e "$blastDir/vcf" ]
then
  vcfDir="$blastDir/vcf"
fi
# if $datasetIdDir may be "" then this condition is required.
if [ -z "$datasetIdDir" ]
then
  unused_var=${datasetIdDir:=$vcfDir/datasetId}
fi
set +x

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
 >> $logFile

# bcftools 'make install' installs by default in /usr/local/bin/
# (yum install is in /usr/bin/ - it is ancient : 0.1.17-dev (r973:277) and does not recognize 'query' command, so prefix with /usr/local/bin)
PATH=/usr/local/bin:${PATH}
echo  \
 PATH=$PATH, \
 >> $logFile



[ -d tmp ] || mkdir tmp

#-------------------------------------------------------------------------------

# Given the argumements to bcftools, other than $datasetIdParam, are in $*,
# extract the chromosome name, e.g. from "... chr1A ..." set chr="1A"
function chrFromArgs()
{
  # $* may be a multi-line string; only output the chr line.
  chr=$( echo "$*" | sed -n 's/\(chr..\).*/\1/;s/.*chr//p')
}

#-------------------------------------------------------------------------------



set -x
# If running within container then unused args fileName=$1 useFile=$2
# are passed.  If running from Flask server they are not passed.
if [ -e /proc/self/fd/3 ]
then
  fileName="$1"
  useFile="$2"
  command="$3"
  datasetIdParam="$4"
  scope="$5"
  shift 5
  # Switch off logging for preArgs, which contains samples which may be a large list.
  set +x
  preArgs="$*"
  echo fileName="$fileName", useFile=$useFile, command="$command", datasetIdParam="$datasetIdParam", scope="$scope", preArgs=$preArgs  >> $logFile
else
  command="$1"
  datasetIdParam="$2"
  scope="$3"
  shift 3
  set +x
  preArgs="$*"
  echo command="$command", datasetIdParam="$datasetIdParam", scope="$scope", preArgs=$preArgs  >> $logFile
fi
set -x


if [ -z "$scope" ]
then
  chrFromArgs "$*"
else
  chr=$scope
fi


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

# The given param $datasetIdParam is the data dataset not the reference;
# possibly both will be required.
# Sanitize datasetIdParam. Allow only alphanumeric and -._ and space.
datasetIdParam=$(echo "$datasetIdParam" | sed 's/[^-A-Za-z0-9._ ]/_/g')

# for dataset.tags.vcfDb : $vcfDir/datasetname/chrXX.vcf.gz, chrXX.vcf.gz.csi
# datasetname/ may be a symbolic link;
# If chrXX.vcf.gz.csi is not present it will be created using 'bcftools index'.
# It's name is derived from chrXX.vcf.gz by appending .csi,
# regardless of whether if chrXX.vcf.gz is a symbolic link

# not required for vcf : datasetId2dbName(), $datasetIdDir

# $datasetId is used directly, instead of $(datasetId2dbName ).


#-------------------------------------------------------------------------------

# Convert one datasetId to $vcfGz
# Echo $vcfGz to stdout
# @param dbName  datasetId
# @return status 0 if dbName dir has files $vcfGz and .csi, where vcfGz is $chr.vcf.gz
function dbName2Vcf() {
  dbName=$1
  datasetId=$dbName

  # (! does not preserve $?, so if that is required, if cd ... ; then : ; else status=$?; echo 1>&$F_ERR "..."; exit $status; fi;  , and equivalent for each if. )
  status=1
  # relative to $vcfDir/$dbName/
  # Some vcf files may have "chr" before $chr.
  vcfGz="$chr.vcf.gz"
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
    status=0
    if [ ! -f "$vcfGz".csi ]
    then
      if ! bcftools index "$vcfGz"
      then
        status=$?
        echo 1>&$F_ERR 'Error:' "No index $vcfGz.csi, and failed to build index."
      fi
    fi
    if [ $status -eq 0 ]
    then
      echo "$dbName/$vcfGz"
    fi
  fi
  return $status
}


function bcftoolsCommand() {
  command="$1";   shift
  vcfGz="$1";     shift
  # ${preArgs[@]}
  # ${@} is ${preArgs[@]}; used this way it is split into words correctly - i.e. 
  # '%ID\t%POS\t%REF\t%ALT[\t%TGT]\n' is a single arg.
  2>&$F_ERR "$bcftools" "$command" "$vcfGz" "${@}"
}

#-------------------------------------------------------------------------------

# This directory check enables dev_result() for dev / loopback test, when blast is not installed.
if false && [ -d ../../pretzel.A1 ]
then
  # sleep 10
  dev_result "$region"
  status=$?
else 
  datasetIds=($(echo "$datasetIdParam" | tr '!' ' '))
  # result when break
  status=1
  for di in ${datasetIds[@]}; do
    vcfGzs+=($(dbName2Vcf "$di"))
    cd $serverDir
    status=0
  done
  # later versions of bash : dbName2Vcf $di || break ... | readarray -t vcfGzs
  echo >> $logFile vcfGzs="${vcfGzs[@]}"
  # vcfGzs[] includes datasetId/ for each dataset
  cd $serverDir/"$vcfDir"

    if [ $status -eq 0 ]
    then
      # Switch off logging for ${@} - contains preArgs, which contains samples which may be a large list.
      # That won't be needed when preArgs.samples is output to a file, and -S (--samples-file) used instead.
      # see vcf-genotype.js : vcfGenotypeLookup() : preArgs.samples
      # set +x
      # some elements in preArgs may contain white-space, e.g. format "%ID\t%POS[\t%TGT]\n"
      vcfGz=${vcfGzs[0]}
      if ! time bcftoolsCommand "$command" "$vcfGz" "${@}"
      then
        echo 1>&$F_ERR 'Error:' "Unable to run bcftools $command $vcfGz $*"
      else
        status=$?	# 0
      fi
      set -x
    fi

fi




# exit $status

#-------------------------------------------------------------------------------
