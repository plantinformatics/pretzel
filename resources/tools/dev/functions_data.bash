#!/bin/bash

# Usage :
# source pretzel/resources/tools/dev/functions_data.bash
# source ~/pretzel/resources/tools/functions_prod.bash
# setToken ...
# loadChr 2H SNPs.vcf.gz  Barley_RGT_Planet_SNPs_10M Hordeum_vulgare_RGT_Planet_v1

# $URL is modified

#-------------------------------------------------------------------------------

snps2Dataset=~/tmp/snps2Dataset.value_0.pl

# check to warn if size of $vcfGz is <  $bytesAvailable / 10
function checkSpace() {
  vcfGz=$1
  bytesAvailable=$(df -k . | tail -n +2  | awk ' { print $4;}')
  gzSize=$(ls -gG "$vcfGz" | awk ' { print $3; } ')
  echo vcfGz="$vcfGz" bytesAvailable=$bytesAvailable gzSize=$gzSize
}

#-------------------------------------------------------------------------------

function datasetAndName2BlockId {
  if [ $# -eq 2 ] ; then
    datasetId=$1
    blockName=$2
     $dockerExec mongo --quiet $DB_NAME --eval "db.Block.find({ datasetId : \"$datasetId\", name : \"$blockName\" }).map( function (b) { return b._id.valueOf(); })" |  tr -d '[:punct:] '
  fi
}

dockerExec="docker exec $DIM"
DB_NAME=pretzel
# or local :
# dockerExec=
# DB_NAME=admin


#-------------------------------------------------------------------------------



# Load 1 chromosome from the given .vcf.gz file
#
# This handles large chromosomes by splitting into chunks and using
# Datasets/createComplete for the first chunk then
# Blocks/blockFeaturesAdd for the remainder.
#
# Column 3 of the vcf is expected to be '.'; this is converted into a unique name "$1:$2"
# Split into 1e5 line chunks, to avoid JSON data too large for curl or node
# (node handles 1e6 OK, but got curl: option --data-binary: out of memory).
#
# Usage in file header comment above.
#
# @param chr  not expected to contain a space or punctuation, e.g. 2H
# @param vcfGz
# @param datasetName  Name of dataset to create and add the chromosome / block to
# @param parentName Name of parent / reference genome for this dataset to reference as parent.
function loadChr()
{
  [ $# -eq 4 ] || (echo "Usage : loadChr chr vcfGz datasetName parentName" 1>&2 ; exit 1)
  chr="$1"
  vcfGz="$2"
  datasetName="$3"
  parentName="$4"
  echo chr=$chr, vcfGz="$vcfGz", datasetName="$datasetName",  parentName="$parentName"

  checkSpace "$vcfGz"

  mkdir ${chr}
  gzip -d < "$vcfGz" | grep "^chr${chr}" | awk -F'\t' ' { printf("%s\t%s\t%s:%s\t%s\t%s\t\n", $1, $2, $1,$2, $4, $5); } '  |   split -l 100000 - ${chr}/

  # cd ${chr}

  echo URL="$URL"; sleep 5

  for splitChunk in $chr/[a-z][a-z]; do
    echo $splitChunk;
    case $splitChunk in
      */aa)
        export URL=localhost:8080/api/Datasets/createComplete
        < "$splitChunk" "$snps2Dataset" -d "$datasetName" -p "$parentName" > "$splitChunk".json
        status=$?
        if [ $status -ne 0 ]
        then
          echo 1>&2 Exit due to error. "$splitChunk" not loaded.;
          return $status
        fi

        # The normal output is small, but error output could be the whole json, so |cut|head.
        time uploadData "$splitChunk".json 2>&1 | cut -c-200 | head -100
        status=$?
        if [ $status -ne 0 ]
        then
          echo 1>&2 Exit due to error. "$splitChunk".json not loaded.;
          return $status
        fi
	# rm "$splitChunk".json

        blockId=$(datasetAndName2BlockId "$datasetName" ${chr} )
        echo blockId=$blockId
        URL=$(echo $URL | sed 's,Datasets/createComplete,Blocks/blockFeaturesAdd,')
        echo URL="$URL"
        ;;
      *)
	   # > $splitChunk.json &&   time
        < $splitChunk "$snps2Dataset" -b $blockId | uploadData - 2>&1 | cut -c-200 | head -100
        status=$?
        if [ $status -ne 0 ]
           then
             echo 1>&2 Exit due to error. "$splitChunk" not loaded.;
             return $status
        fi
      ;;
    esac
  done
  # cd ..
}
