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

#-------------------------------------------------------------------------------

function filterOutComments
{
  sed '/^#/d;/^"#/d'
  # or egrep -v '^#|^"#' | 
}

# Sanitize input by removing punctuation other than comma, _, ., \n
# Commonly _ and . are present in parentName.
function deletePunctuation()
{
    tr -d  -c '[,\n_.][:alnum:]'
}
# Split the Metadata table into 1 file per dataset, with the left
# column (Field names) and the dataset column.
# Name the file out/"$fileName"/$datasetName.Metadata.csv
function splitMetadata()
{
  fileDir=out/"$fileName"
  # Remove any tmp files from previous upload.
  [ -d "$fileDir" ] && rm -r "$fileDir"
  mkdir "$fileDir"
  meta4dataset="$fileDir"/"$datasetName".Metadata.csv

  # Filter out comments.
  < "$fileName".Metadata.csv sed  '/^#/d;/^"#/d' > "$fileDir"/Metadata.csv
  # Select the first line. Trim off Field,. Trim spaces around , and |. Convert , to " ", prepend and append ".
  # Result is the headings of the dataset columns, e.g. Alignment|EST_SNP, Map|Red x Blue
  eval datasetNames=( $(< "$fileDir"/Metadata.csv head -1 | quotedHeadings) )
  # 
  for di in ${!datasetNames[*]};
  do
    echo $di ${datasetNames[$di]} >>  uploadSpreadsheet.log;
    datasetMeta="$fileDir"/${datasetNames[$di]}.Metadata.csv
    < "$fileDir"/Metadata.csv sed '/^#/d;/^"#/d' | cut -d, -f 1,$(($di+2)) | tail -n +2  > "$datasetMeta" ;
  done
}

# Given the headings line (first non-comment line), convert to quoted column header strings.
# These are the dataset names, with the prefix 'Map|', 'Alignment|' etc.
# i.e.
# . discard col1 (Field,)
# . trim spaces around , and |
# . ensure " at ^ and $
# . ensure " before and after comma
# . convert comma to space
function quotedHeadings()
{
  sed 's/^Field,//;
s/ *, */,/g;s/ *| */|/g;
s/^\([^"]\)/"\1/;s/\([^"]\)$/\1"/;
s/,\([^"]\)/,"\1/;s/\([^"]\),/\1",/g;
s/,/ /g;'
  }

# get namespace and commonName from metadata :
function readMetadata()
{
  worksheetName=$(echo "$i" | fileName2worksheetName)
  datasetMeta="$fileDir"/"$worksheetName".Metadata.csv

  eval $( < "$datasetMeta" egrep  '^(commonName|parentName|platform|shortName),' | deletePunctuation \
   | awk -F, '{ printf("%s=%s;\n", $1, $2); }' )
  echo namespace=$namespace, commonName=$commonName >> uploadSpreadsheet.log
}

# echo PATH=$PATH
mv "$fileName" tmp/.
cd tmp
# out/ was for .csv, maybe not needed
[ -d out ] || mkdir out out_json
#[ -d chrSnps ] || mkdir chrSnps

# Extract datasetName from filename of the worksheet csv
function fileName2worksheetName() {
  sed  's/\.csv$//;s/.*\.\([A-Za-z ]*\)|/\1|/;s/^  *//;s/  *$//;s/ *| */|/g;';
}

# Extract datasetName from filename of the worksheet csv
function fileName2DatasetName() {
  # Trim off trailing .csv and fileName and worksheet label up to |
  # Trim off outside spaces.
  # input : $worksheetFileName, output: $datasetName
  sed  's/\.csv$//;s/.*|//;s/^  *//;s/  *$//;';
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
  # There may not be a comma after Position and End.
  export columnsKeyString=$(head -1 "$worksheetFileName" | sed "s/Marker,/name,/i;s/Name,/name,/;s/Chromosome,/chr,/;
s/,Qs,/,pos,/;s/,Qe/,end/;
s/,Start,/,pos,/i;s/,End/,end/i;
s/,Position/,pos/i;
s/,/ /g;
")
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

# @param env $i worksheetFileName 
function linkageMap()
{

    datasetName=$(echo "$i" | fileName2DatasetName);
    echo "fileName=$fileName, datasetName=$datasetName" >> uploadSpreadsheet.log;
    columnsKeyStringPrepare "$i" || return $?
    # ../ because of cd tmp
    out=out_json/"$i".json
    <"$i"  chrOmit |  ../$sp "${optionalArgs[@]}" -d "$datasetName" -p '' -n "$namespace" -c "$commonName" -g  >  "$out" ;
    ls -gG "$out"  >> uploadSpreadsheet.log;
    # upload() will read these files
    echo "tmp/$out;$datasetName"
}

# @param env $i worksheetFileName 
function snpList()
{
    datasetName=$(echo "$i" | fileName2DatasetName);
    echo "fileName=$fileName, datasetName=$datasetName" >> uploadSpreadsheet.log;
    # or continue/break. whether to check later worksheets in the file for errors ?
    columnsKeyStringPrepare "$i" || return $?

    out=out_json/"$i".json
    # 'tail -n +2' to remove header before sort.  (note also headerLine()).

    # from metadata : parentName platform shortName commonName

    # $datasetNameFull is $datasetName, with $parentName. prefixed, if it is
    # defined; this is the actual dataset name created, and the value
    # used by removeExisting().

    if [ -n "$parentName" ]
    then
      datasetNameFull="$parentName.$datasetName"
      nameArgs=(-d "$datasetNameFull" -p $parentName -n"$parentName:$platform")
    else
      datasetNameFull="$datasetName"
      nameArgs=(-d "$datasetName" )
      if [ -n "$platform" ]
      then
        nameArgs+=(-n "$platform")
      fi
    fi
    if [ -n "$shortName" ]
    then
      nameArgs+=(-s "$shortName")
    fi
    if [ -n "$commonName" ]
    then
      nameArgs+=(-c "$commonName")
    fi

    columnHeaderFile=out/columnHeaders.csv
    <"$i" filterOutComments | head -1 > $columnHeaderFile
    (cat $columnHeaderFile; \
     <"$i" filterOutComments | tail -n +2  | chrOmit |  sort -t, -k 2 ) |  \
      ../$sp "${nameArgs[@]}" "${optionalArgs[@]}" 	\
      >  "$out"
    ls -gG "$out"  >> uploadSpreadsheet.log;
    # upload() will read these files
    echo "tmp/$out;$datasetNameFull"
}

# The 'Chromosome Renaming' worksheet was handled here by chrRenamePrepare() and chrRename() up until 7b0bbf20,
# by creating a .sed script from the 'Chromosome Renaming' worksheet and applying it to rename the chromosome column.
# Now this is done by passing $chrRenameCSV via optionalArgs to $sp.
#
# related in functions_convert.bash : sed -f chrSnps/"$datasetName".chrRename.sed |
# and : sed -f $genBankRename |


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

# If the spreadsheet contains a 'Chromosomes to Omit' worksheet, (i.e. $chrOmitSed is defined)
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
  # "" around $fileName not required here - bash does not split the var value at white-space
  case $fileName in
    *' '*)
      # [ -d renamed ] || mkdir renamed
      fileNameTo=$(echo "$fileName" | sed "s/ /_/g")
      renamed="$fileNameTo"
      # renamed/; mkdir $renamed
      suffix=$(echo $fileName | sed -n "s/.*\.//p")
      newName="$fileNameTo" # $renamed/1."$suffix"
      mv "$fileName" $newName
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
      chrOmitPrepare
      splitMetadata

      # i is worksheetFileName
      for i in "$fileName".*'|'*csv
      do
        echo "i=$i" >> uploadSpreadsheet.log;

        readMetadata

        optionalArgs=()
        if [ -f "$datasetMeta" ]
        then
          optionalArgs=(-M "$datasetMeta")
        fi

        chrRenameCSV=$(echo "$fileName".*'Chromosome Renaming'*csv)
        if [ -f "$chrRenameCSV" ]
        then
          optionalArgs+=(-R "$chrRenameCSV")
        fi

        # (until f556a24e, the fileName prefix guided which of these
        # functions was called, but now the fileName is arbitrary and
        # only the worksheet name indicates the type of dataset)
        case $i in
          "$fileName".*Map'|'*csv)
            linkageMap
            status=$?
            ;;
          "$fileName".*Alignment'|'*csv)
            snpList
            status=$?
            ;;
          # Later : QTL, Genome, etc
          *)
            echo "$i : expected Map|, Alignment| *" >> uploadSpreadsheet.log
            ;;

        esac
      done

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

