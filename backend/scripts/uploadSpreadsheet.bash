#!/bin/bash

toolsDev=../resources/tools/dev
sp=$toolsDev/snps2Dataset.pl
source $toolsDev/functions_convert.bash

echo $* >> uploadSpreadsheet.log

[ -d tmp ] || mkdir tmp

set -x
fileName=$1
useFile=$2

# Sanitize input by removing punctuation other than comma
function deletePunctuation()
{
    tr -d  -c '[,\n][:alnum:]'
}
# get namespace and commonName from metadata :
function readMetadata()
{
  eval $( < $fileName.Metadata.csv deletePunctuation | awk -F, ' { printf("%s=%s;\n", $1, $2); }' )
  echo namespace=$namespace, commonName=$commonName >> uploadSpreadsheet.log
}

# echo PATH=$PATH
mv "$fileName" tmp/.
cd tmp
[ -d out ] || mkdir out out_json
#[ -d chrSnps ] || mkdir chrSnps

function fileName2DatasetName() {
  sed -n 's/\.csv$//;s/Linkage_Map_//ig;s/ X / x /g;s/.*\.\(xlsx\|xls\|ods\)\.//p;';
}

# Used in snps2Dataset.pl
export columnsKeyString="name chr pos"

function linkageMap()
{
  # fileName=$1
  echo "linkageMap fileName=$fileName" >> uploadSpreadsheet.log;
  for i in "$fileName".*' x '*csv
  do
    datasetName=$(echo "$i" | fileName2DatasetName);
    echo "$datasetName"
    echo "fileName=$fileName, datasetName=$datasetName" >> uploadSpreadsheet.log;
    # option before $sp : sed -f chrSnps/"$datasetName".chrRename.sed |
    # ../ because of cd tmp
    <"$i"     ../$sp -d "$datasetName" -p '' -n "$namespace" -c "$commonName" -g  >  out_json/"$i".json ; ls -gG out_json/"$i".json 
  done
}


case $fileName in
    *.xlsx|*.xls|*.ods)
	echo ssconvert >> uploadSpreadsheet.log
	# for streaming input : if [ "$useFile" != true ] ; then cat >"$fileName"; fi
	ssconvert -S "$fileName" "$fileName.%s.csv"
	status=$?
	echo ssconvert status $status >> uploadSpreadsheet.log
	if [ $status -eq 0 ]
	then
	    readMetadata
	    case $fileName in
		Linkage_Map*)
		    linkageMap
		    status=$?
		;;
		# Later : SNP, QTL etc
		*)
		echo "$fileName : expected Linkage_Map*" >> uploadSpreadsheet.log
		;;
	    esac

	fi
	;;
    *)
	echo $*	.xlsx, .xls, or .ods expected >>uploadSpreadsheet.log
	status=$?
	;;
esac


exit $status

