#!/bin/bash

case $PWD in
  *backend)
    resourcesDir=../resources
    ;;
  *)
    resourcesDir=resources
    ;;
esac
toolsDev=$resourcesDir/tools/dev
sp=$toolsDev/snps2Dataset.pl
source $toolsDev/functions_convert.bash

echo $* >> uploadSpreadsheet.log

[ -d tmp ] || mkdir tmp

set -x
fileName=$1
useFile=$2

# Sanitize input by removing punctuation other than comma, _, ., \n
# Commonly _ and . are present in parentName.
function deletePunctuation()
{
    tr -d  -c '[,\n_.][:alnum:]'
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

set +x
# Long names for column headers
declare -A columnFullName
columnFullName['name']=Name
columnFullName['chr']=Chromosome
columnFullName['pos']=Position
columnFullName['end']=Position_End
set -x

# Handle some variation in the recognised column header names.
# Prepate columnsKeyString, which is used in snps2Dataset.pl
# @param worksheetFileName	name of .csv output for 1 worksheet
columnsKeyStringPrepare()
{
  worksheetFileName=$1
  head -1 "$worksheetFileName" >> uploadSpreadsheet.log
  export columnsKeyString=$(head -1 "$worksheetFileName" | sed "s/Marker,/name,/i;s/Name,/name,/;s/Chromosome,/chr,/;s/,Qs,/,pos,/;s/,Qe,/,end,/;s/,/ /g")
  echo columnsKeyString="$columnsKeyString"  >> uploadSpreadsheet.log

  # Check that the required columns are present
  errorMessages=
  for columnName in name chr pos
  do
    echo "$columnsKeyString" | fgrep -q "$columnName" || errorMessages+="${columnFullName[$columnName]} column is required. "
  done
  if [ -n "$errorMessages" ]
  then
    # maybe to stderr
    echo "Error: '$worksheetFileName' : $errorMessages;$datasetName"
  fi
  # return true (0) if there are no errors
  [ -z "$errorMessages" ]
}

function linkageMap()
{
  # fileName=$1
  echo "linkageMap fileName=$fileName" >> uploadSpreadsheet.log;
  for i in "$fileName".*' x '*csv
  do
    # if no files match the regexp, then i will be the un-expanded regexp.
    if [ \! -f "$i" ] ; then continue; fi;
    datasetName=$(echo "$i" | fileName2DatasetName);
    echo "fileName=$fileName, datasetName=$datasetName" >> uploadSpreadsheet.log;
    columnsKeyStringPrepare "$i" || return $?
    # ../ because of cd tmp
    out=out_json/"$i".json
    <"$i"  chrOmit | chrRename |  ../$sp -d "$datasetName" -p '' -n "$namespace" -c "$commonName" -g  >  "$out" ;
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
    if [ \! -f "$i" ] ; then continue; fi;
    datasetName=$(echo "$i" | fileName2DatasetName);
    echo "fileName=$fileName, datasetName=$datasetName" >> uploadSpreadsheet.log;
    # or continue/break. whether to check later worksheets in the file for errors ?
    columnsKeyStringPrepare "$i" || return $?
    out=out_json/"$i".json
    # remove header before sort.  (note also headerLine()).
    # from metadata : parentName platform shortName commonName
    if [ -n "$parentName" ]
    then
      nameArgs=(-d "$parentName.$datasetName" -p $parentName -n"$parentName:$platform")
    else
      nameArgs=(-d "$datasetName"  -n"$platform")
    fi
    if [ -n "$shortName" ]
    then
      nameArgs+=(-s "$shortName")
    fi
    <"$i" tail -n +2  | chrOmit | chrRename |  sort -t, -k 2  |  \
      ../$sp "${nameArgs[@]}" -c "$commonName"  	\
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

# If the spreadsheet contains a 'Chromosomes to Omit' worksheet,
# then create a .sed script to filter out SNPs with those values in chromosome column.
function chrOmitPrepare()
{
  chrOmitCSV=$(echo "$fileName".*[Cc]hromosomes' to '[Oo]mit*csv)
  if [ -f "$chrOmitCSV" ]
  then
    chrOmitSed=out/"$fileName".chrOmit.sed
    # Can change this to generate awk which can target only the chromosome column.
    #
    # Match the leading comma and not the following comma because the
    # data case in hand has a fixed part followed by an id; perhaps
    # change to regexp.
    < "$chrOmitCSV" awk -F, '{ printf("/,%s/d\n", $1); }' > $chrOmitSed
  fi
}

# If the spreadsheet contains a 'Chromosome Renaming' worksheet, (i.e. $chrOmitSed is defined)
# then map the chromosome column as indicated.
function chrOmit()
{
  if [ -n "$chrOmitSed" ]
  then
    sed -f "$chrOmitSed"
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
    # Remove outputs from previous upload of $fileName
    rm -f "$fileName".*.csv
    # for streaming input : if [ "$useFile" != true ] ; then cat >"$fileName"; fi
    spreadsheetConvert -S "$fileName" "$fileName.%s.csv"
    status=$?
    echo ssconvert status $status >> uploadSpreadsheet.log
    if [ $status -eq 0 ]
    then
      readMetadata
      chrRenamePrepare
      chrOmitPrepare
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
      if [ -z "$datasetName" ]
      then
	echo "Error: '$fileName' : no worksheets defined datasets. ;"
	ls -gG "$fileName".*csv  >> uploadSpreadsheet.log
      fi

    fi
    ;;
  *)
    echo $*  .xlsx, .xls, or .ods expected >>uploadSpreadsheet.log
    status=$?
    ;;
esac


exit $status

