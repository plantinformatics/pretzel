#!/bin/bash

toolsDev=resources/tools/dev
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
# out/ was for .csv, maybe not needed
[ -d out ] || mkdir out out_json
#[ -d chrSnps ] || mkdir chrSnps

function fileName2DatasetName() {
  sed -n 's/\.csv$//;s/Linkage_Map_//ig;s/SNP_List_//ig;s/ X / x /g;s/SNP //g;s/.*\.\(xlsx\|xls\|ods\)\.//p;';
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
    echo "fileName=$fileName, datasetName=$datasetName" >> uploadSpreadsheet.log;
    # ../ because of cd tmp
    out=out_json/"$i".json
    <"$i"  chrRename |  ../$sp -d "$datasetName" -p '' -n "$namespace" -c "$commonName" -g  >  "$out" ;
    ls -gG "$out"  >> uploadSpreadsheet.log;
    # upload() will read these files
    echo "tmp/$out;$datasetName"
  done
}

function snpList()
{
  # fileName=$1
  echo "snpList fileName=$fileName" >> uploadSpreadsheet.log;
  for i in "$fileName".*SNP' '*csv
  do
    datasetName=$(echo "$i" | fileName2DatasetName);
    echo "fileName=$fileName, datasetName=$datasetName" >> uploadSpreadsheet.log;
    out=out_json/"$i".json
    # remove header before sort.  (note also headerLine()).
    # from metadata : parentName platform shortName commonName
    <"$i" tail -n +2  | chrRename |  sort -t, -k 2  |  \
      ../$sp -d "$parentName.$datasetName" -s "$shortName" -p $parentName -n"$parentName:$platform" -c "$commonName"  	\
      >  "$out"
    ls -gG "$out"  >> uploadSpreadsheet.log;
    # upload() will read these files
    echo "tmp/$out;$parentName.$datasetName"
  done
}

# If the spreadsheet contains a 'Chromosome Renaming' worksheet,
# then create a .sed script to rename the chromosome column.
function chrRenamePrepare()
{
  # related in functions_convert.bash : sed -f chrSnps/"$datasetName".chrRename.sed |
  # and : sed -f $genBankRename |
  chrRenameCSV=$(echo "$fileName".*'Chromosome Renaming'*csv)
  if [ -f "$chrRenameCSV" ]
  then
    chrRenameSed=out/"$fileName".chrRename.sed
    # Can change this to generate awk which can target only the chromosome column.
    < "$chrRenameCSV" awk -F, '{ printf("s/,%s,/,%s,/\n", $1, $2); }' > $chrRenameSed
  fi
}

# If the spreadsheet contains a 'Chromosome Renaming' worksheet, (i.e. $chrRenameSed is defined)
# then map the chromosome column as indicated.
function chrRename()
{
  if [ -n "$chrRenameSed" ]
  then
    sed -f "$chrRenameSed"
  else
    cat
  fi
}

# Spaces in $fileName are not handled when running ssconvert via docker, so
# rename the file into a directory
function renameIfSpaces()
{
  case $fileName in
    *' '*)
      # [ -d renamed ] || mkdir renamed
      fileNameTo=$(echo "$fileName" | sed "s/ /_/g")
      renamed="$fileNameTo"
      # renamed/; mkdir $renamed
      suffix=$(echo $fileName | sed -n "s/.*\.//p")
      newName="$fileNameTo" # $renamed/1."$suffix"
      mv -i "$fileName" $newName
      fileName="$newName"
      ;;
    *)
      ;;
  esac
}

function spreadsheetConvert()
{
  # installation of ssconvert (gnumeric) on centos had dependency problems, so using docker
  if [ -f /etc/system-release-cpe ]
  then
    renameIfSpaces
    # if renameIfSpaces has changed $fileName, then "$2" and "$3" need to change also
    # Perhaps switch from centos and install ssconvert directly; but if renameIfSpaces
    # is needed, can refactor this to pass in $fileName perhaps.
    docker run \
	   -u $(id -u):$(id -g) \
	   -v /home/ec2-user/pretzel/tmp:/home/user \
	   -e PARAMS="$1" \
	   -e FILETOREAD="$fileName" \
	   -e FILETOWRITE="$fileName.%s.csv" \
	   nalscher/ssconvert:latest
  else
    ssconvert "$1" "$2" "$3"
  fi
}

case $fileName in
  *.xlsx|*.xls|*.ods)
    ls -gGd "$fileName" >> uploadSpreadsheet.log
    echo ssconvert >> uploadSpreadsheet.log
    # for streaming input : if [ "$useFile" != true ] ; then cat >"$fileName"; fi
    spreadsheetConvert -S "$fileName" "$fileName.%s.csv"
    status=$?
    echo ssconvert status $status >> uploadSpreadsheet.log
    if [ $status -eq 0 ]
    then
      readMetadata
      chrRenamePrepare
      case $fileName in
        Linkage_Map*|*[Ll]inkage*[mM]ap*)
          linkageMap
          status=$?
          ;;
        SNP_List*)
          snpList
          status=$?
          ;;
        # Later : QTL etc
        *)
          echo "$fileName : expected Linkage_Map*" >> uploadSpreadsheet.log
          ;;
      esac

    fi
    ;;
  *)
    echo $*  .xlsx, .xls, or .ods expected >>uploadSpreadsheet.log
    status=$?
    ;;
esac


exit $status

