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
# functions_convert.bash is related, but not a current dependency
# source $toolsDev/functions_convert.bash

echo $* >> uploadSpreadsheet.log

[ -d tmp ] || mkdir tmp

set -x
fileName=$1
useFile=$2

#-------------------------------------------------------------------------------

if ls -l /bin/ls | fgrep -q /bin/busybox
then
    function ll() { ls -l "$@"; }
else
    function ll() { ls -gG "$@"; }
fi

#-------------------------------------------------------------------------------

function filterOutComments
{
  sed '/^#/d;/^"#/d'
  # or egrep -v '^#|^"#' | 
}

# Sanitize input by removing punctuation other than comma, _, ., \n, space.
# Commonly _ and . are present in parentName.
# Space appears in commonName.
function deletePunctuation()
{
    tr -d  -c '[,\n_. ][:alnum:]'
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
    diN="${datasetNames[$di]}"
    echo $di $diN >>  uploadSpreadsheet.log;
    # Skip columns with empty dataset name.
    [ "$diN" = 'empty_datasetName' ] && continue;
    datasetMeta="$fileDir"/"$diN".Metadata.csv
    # original didn't handle comma in quoted cell value : cut -d, -f 1,$(($di+2)) | 
    datasetColumn=$(($di+1))
    < "$fileDir"/Metadata.csv sed '/^#/d;/^"#/d' | \
        perl -e 'use Text::ParseWords; while (<>) { chomp; my @a =  parse_line(",", 0, $_); print "\"$a[0]\",\"$a['$datasetColumn']\"\n"; }'	| \
        tail -n +2  > "$datasetMeta" ;
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
# If the dataset name field is empty, flag it with 'empty_datasetName'
function quotedHeadings()
{
  sed 's/^Field,//;
s/ *, */,/g;s/ *| */|/g;
s/,,/,empty_datasetName,/g;
s/,,/,empty_datasetName,/g;
s/,$/,empty_datasetName/;
s/^\([^"]\)/"\1/;s/\([^"]\)$/\1"/;
s/,\([^"]\)/,"\1/g;s/\([^"]\),/\1",/g;
s/,/ /g;'
  }

# get namespace and commonName from metadata :
function readMetadata()
{
  worksheetName=$(echo "$i" | fileName2worksheetName)
  datasetMeta="$fileDir"/"$worksheetName".Metadata.csv

  eval $( < "$datasetMeta" egrep  '^(commonName|parentName|platform|shortName),' | deletePunctuation \
   | awk -F, '{ printf("%s=\"%s\";\n", $1, $2); }' )
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
  export columnsKeyString=$(head -1 "$worksheetFileName" | sed "s/Marker,/name,/i;s/Name,/name,/g;s/Chromosome,/chr,/;
s/,Qs,/,pos,/;s/,Qe/,end/;
s/,Start,/,pos,/i;s/,End/,end/i;
s/,Position/,pos/i;
s/,/ /g;
")
  echo columnsKeyString="$columnsKeyString"  >> uploadSpreadsheet.log

  # sanitize input
  clean=$(echo -n "$columnsKeyString" | tr -cd '[:alnum:] [:space:]')
  eval columnsKeyStringArray=($clean)
  # filter out the column headings containing space to avoid space in array index.
  # Use < <( ) instead of | so that columnsNum is not confined within sub-shell created by |.
  declare -A columnsNum
  columnsNum=(); while read columnNum columnName ; do columnsNum[$columnName]=$columnNum ; done < <(for columnName1 in "${columnsKeyStringArray[@]}"; do echo "$columnName1"; done | cat -n | grep -v '	.* ')
  # column heading parentName is reduced to lower case : parentname
  columnNum_parentName=${columnsNum[parentname]}
  columnNum_chr=${columnsNum[chr]}
  # e.g. 7

  # Check that the required columns are present
  errorMessages=
  for columnName in name chr pos
  do
    echo "$columnsKeyString" | fgrep -q "$columnName" || errorMessages+="${columnFullName[$columnName]} column is required. "
  done
  if [ -n "$errorMessages" ]
  then
    # Output to Error channel back to server. (maybe also to stderr?)
    echo 1>&3 "Error: '$worksheetFileName' : $errorMessages;$datasetName"
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
    ll "$out"  >> uploadSpreadsheet.log;
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
     <"$i" filterOutComments | tail -n +2  | chrOmit |  sort -t, -k $columnNum_chr,$columnNum_chr ) |  \
      ../$sp "${nameArgs[@]}" "${optionalArgs[@]}" 	\
      >  "$out"
    ll "$out"  >> uploadSpreadsheet.log;
    # upload() will read these files
    echo "tmp/$out;$datasetNameFull"
}

function qtlList()
{
    datasetName=$(echo "$i" | fileName2DatasetName);
    echo "fileName=$fileName, datasetName=$datasetName" >> uploadSpreadsheet.log;
    columnsKeyStringPrepare "$i" || return $?
    cd ..
    # out=out_json/"$i".json
    outDir=tmp/"$fileDir"/out_json
    #  or && rm -r "$outDir"
    [ -d "$outDir" ] || mkdir "$outDir"
    # If the dataset worksheet has a column in Metadata, append to that file, otherwise /metaType.csv
    if [ -f tmp/"$datasetMeta" ]
    then
      metaTypeFile=tmp/"$datasetMeta"
      # $datasetMeta is already listed in $prefixedArgs
      echo "type,QTL" >> "$metaTypeFile"
    else
      metaTypeFile=tmp/"$fileDir"/metaType.csv
      localArgs=(-M "$metaTypeFile")
      echo "type,QTL" > "$metaTypeFile"
    fi
    prefixTmpToArgs

    # Could use tac | ... -A 'Flanking Markers', as in comment re. $arrayColumnName in snps2Dataset.pl 
    # (-A is not required now - have added support for all Flanking Markers in a single row/cell, which is the preference)
    # 
    # Sort by parentName (if defined) then chr column
    #
    # originally : sortKeys was -k $columnNum_chr,..., but now using perl to prefix the sort
    # values, so sortKeys is now the sort key column numbers, rather than the
    # sort(1) key param
    sortKeys=($columnNum_chr)
    sortkeys2=-k1
    if [ -n "$columnNum_parentName" ]
    then
      sortKeys=($columnNum_parentName  "${sortKeys[@]}")
      sortKeys2=-k1,2
    fi

    # Place the column header row first, don't sort it.
    columnHeaderFile=tmp/out/columnHeaders.csv
    <tmp/"$i" filterOutComments | head -1 > $columnHeaderFile
    # 1st perl :
    # Remove non-ascii and quotes around alphanumeric, to handle chr with &nbsp wrapped in quotes, which impairs sorting.
    # 2nd perl prepends sort key, in place of : #  sort -t, "${sortKeys[@]}" ) |
    (cat $columnHeaderFile; \
     <tmp/"$i" filterOutComments | tail -n +2 | \
       perl -p -e 's/[^[:ascii:]]+//g;s/"([-A-Za-z0-9_.]+)"/\1/g'  | \
       chrOmit |
       perl -e 'use Text::ParseWords; while (<>) { chomp; my @a =  parse_line(",", 0, $_); foreach $k (split(/ /, "'"${sortKeys[*]}"'")) { print "\"$a[$k-1]\"<";}; print "<ENDofSortKey<$_\n"; }'	| \
       sort -t'<' $sortKeys2 ) |
       sed "s/.*<ENDofSortKey<//" |
       tee tmp/"$i".sorted | \
       $sp "${prefixedArgs[@]}" -d "$datasetName"  -n "$namespace" -c "$commonName" -g  "${localArgs[@]}" -t QTL -D "$outDir" ;
    # ll "$out"  >> uploadSpreadsheet.log;
    # upload() will read these files
    # echo "tmp/$out;$datasetName"
    cd "$outDir";
    for datasetFile in *.json
    do
      datasetName=$(echo "$datasetFile" | sed 's/.json$//')
      echo "$outDir/$datasetFile;$datasetName"
    done
}

# Prefix tmp/ to the paths in $optionalArgs
# Put the result in $prefixedArgs.
function prefixTmpToArgs()
{
  prefixedArgs=(); for arg in "${optionalArgs[@]}"; do case "$arg" in  out/*|*csv) prefixedArgs+=("tmp/$arg");; *) prefixedArgs+=("$arg");; esac; done;
  echo "${prefixedArgs[@]}" >> uploadSpreadsheet.log;
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
    # Skip empty lines, because they would generate /,/d which filters out everything.
    # Match the leading comma and not the following comma because the
    # data case in hand has a fixed part followed by an id; perhaps
    # change to regexp.
    < "$chrOmitCSV" awk -F, '/./ { printf("/,%s/d\n", $1); }' > $chrOmitSed
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

# These warnings output by ssconvert do not seem to be significant :
# Undefined number format id '43'
# Undefined number format id '41'
# Undefined number format id '44'
# Undefined number format id '42'
# Unexpected element 'workbookProtection' in state : 
#	workbook
#
# from unzip of the .xlsx : ./xl/styles.xml : 
# ...
#  <cellStyleXfs count="20">
#  ...
#     <xf numFmtId="43" fontId="1" fillId="0" borderId="0" applyFont="true" applyBorder="false" applyAlignment="false" applyProtection="false">
#     </xf>
# ... ditto for 41, 44, 42
# These 4 numFmtId are not defined; see the list here : https://stackoverflow.com/a/4655716
# ...
# 40 = '#,##0.00;[Red](#,##0.00)';
# 
# 44 = '_("$"* #,##0.00_);_("$"* \(#,##0.00\);_("$"* "-"??_);_(@_)';
# 45 = 'mm:ss';
# ...
# from https://stackoverflow.com/questions/4655565/reading-dates-from-openxml-excel-files
# which also links :
# https://docs.microsoft.com/en-us/previous-versions/office/developer/office-2010/ee857658(v=office.14)
# which also does not define those 4 Numfmtid-s

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
    ll -d "$fileName" >> uploadSpreadsheet.log
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
      warningsFile="$fileDir"/warnings

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
          "$fileName".*'| Template'*csv)
            msg="$i : worksheet name is Template"
            echo "$msg" >> uploadSpreadsheet.log
            echo "$msg" >> "$warningsFile"
            ;;

          "$fileName".*Map'|'*csv)
            linkageMap
            status=$?
            ;;
          "$fileName".*Alignment'|'*csv)
            snpList
            status=$?
            ;;
          "$fileName".*QTL'|'*csv)
            qtlList
            status=$?
            ;;
          # Later : Genome, etc
          *)
            echo "$i : expected Map|, Alignment|, QTL| *" >> uploadSpreadsheet.log
            ;;

        esac
      done

      if [ -z "$datasetName" ]
      then
        if [ -f "$warningsFile" ]
        then
          warningsText="      Warnings: "$(cat "$warningsFile")
        else
          warningsText=
        fi
        echo "Error: '$fileName' : no worksheets defined datasets. $warningsText;"
        ll "$fileName".*csv  >> uploadSpreadsheet.log
      else
        if [ -f "$warningsFile" ]
        then
          cat "$warningsFile" 1>&4
        fi
      fi

    fi
    ;;
  *)
    echo $*  .xlsx, .xls, or .ods expected >>uploadSpreadsheet.log
    status=$?
    ;;
esac


exit $status

