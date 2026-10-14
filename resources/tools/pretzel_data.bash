# Source this file

# Defines environment variables and functions for installing / managing Pretzel
# data (e.g. VCF genotype files, Blast databases) on this instance.

# Uses these variables defined in ./pretzel_env.bash
export pretzelDir; : ${pretzelDir:=$HOME/pretzelDir}
export pp; : ${pp:=$data/pretzel}
export composeName; : ${composeName:=pretzel}
export systemUser; : ${systemUser:=ec2-user}
export pretzelUser; : ${pretzelUser:=pretzelUser}


#-------------------------------------------------------------------------------

# Check that all of $pp/data/ sub-directories and files are owned by
# $pretzelUser:$pretzelUser, not e.g. $systemUser:$systemUser
function dataOwnerCheck()
{
  cd $pp/data
  find . \!  \( -user $pretzelUser -a -group $pretzelUser \) -ls
}
function dataOwnerFix()
{
  cd $pp/data
  # find . \( -user $systemUser -o -group $systemUser \) -ls
  sudo chown -R --from $systemUser $pretzelUser .
  sudo chown -R --from root $pretzelUser .
  # chgrp: unrecognized option '--from'
  # sudo chgrp -R --from $systemUser $pretzelUser .
  # sudo chgrp -R --from root $pretzelUser .
  # Use this instead of chgrp  --from :
  # xargs -r is --no-run-if-empty. used because chown and chgrp require a non-empty parameter list
  find .  \( -group $systemUser -o -group root \) -print | xargs -r -t -d'\n' sudo chgrp $pretzelUser

  find . \!  \( -user $pretzelUser -a -group $pretzelUser \) -print | xargs -r -t -d'\n' sudo chown $pretzelUser:$pretzelUser
}


#-------------------------------------------------------------------------------

# Show the current vcfGenotypeLookup / bcftools processes
function psVcf()
{
  # This also shows the child process bcftools.
  pstree -a  -p $(pgrep  'vcfGenotypeLook')
}
# Show the CPU and memory load of the current vcfGenotypeLookup / bcftools processes
function topVcf()
{
  top -bn1 -p $(pgrep -d, 'bcftools|vcfGenotypeLook')
}

#-------------------------------------------------------------------------------

# Report to stderr any soft links in $pp/data/ which do not refer to an existing
# file or directory.
function checkLinks()
{
  (cd $pp/data ; find . -type l -print | xargs -d'\n' ls -Ld 1>/dev/null)
}

#-------------------------------------------------------------------------------

# filename regular expression pattern to match chromosome VCF files.
# Used in checkVcf() to avoid listing the non-chromosome files,
# which would otherwise break up the column pattern.
#
# This variable can defined here if all your datasets use the same prefix for
# chromosome VCF files.
# checkVcfAll() calculates this automatically for each dataset directory using
# guessChrPattern().
#
# chrPattern="[Cc]hr"

# Read stdin and output the most frequently-recurring line of text
function mostFrequent()
{
  # Refn : Gemini and https://www.youtube.com/watch?v=oPEnvuj9QrI&vl=en&t=91
  #
  # count[$0]++: Reads each entire line ($0) and counts how many times it appears in an associative array.
  #  [1](https://stackoverflow.com/questions/35750431/input-large-text-file-and-output-most-frequent-words-text-file-using-awk),
  #  [2](https://www.geeksforgeeks.org/linux-unix/awk-command-unixlinux-examples/),
  #  [3](https://linuxcommand.org/lc3_adv_awk.php)
  # END { ... }: Runs a block of code after all lines from stdin have been processed.
  #  [1](https://linuxcommand.org/lc3_adv_awk.php),
  #  [2](https://www.geeksforgeeks.org/linux-unix/awk-command-unixlinux-examples/)
  # max and best: Tracks the highest occurrence count and saves the corresponding line text.
  # print best: Outputs the line that appeared the most. [1](https://medium.com/meetcyber/the-awk-command-ea54d9adf08f)
  #
  awk '{count[$0]++} END {max=0; for (line in count) if (count[line] > max) {max = count[line]; best = line} print best}'
}
# Same as mostFrequent(); Alternative approach using sort and uniq.
function mostFrequentAlt()
{
  # sort: Groups identical lines together.
  # uniq -c: Counts the occurrences of each unique line.
  # sort -nr: Sorts the counts in reverse numerical order (highest count first).
  # head -n 1: Outputs only the top line.
  # appended sed to strip off the count, leaving just the text
  sort | uniq -c | sort -nr | head -n 1 | sed 's/^ *[0-9][0-9]* //'
}
function guessChrPattern()
{
  ls | sed 's/[0-9].*//' |  mostFrequent
}

# Construct the sed commands used in checkVcf() to join on a single line,
# multiple lines which have names of a single chromosome.
#
# Explanation of how it works :
# /PATTERN/: Finds the line that matches your desired pattern.
#  [1](https://www.grymoire.com/Unix/Sed.html),
#  [2](https://www.ibm.com/docs/ssw_aix_72/s_commands/sed.html)
# {...}: Groups the commands to execute only when the pattern is matched. [1](https://www.ibm.com/docs/ssw_aix_72/s_commands/sed.html)
# N: Appends the Next line of input into the pattern space, pulling the newline character (\n) into play.
#  [1](https://stackoverflow.com/questions/1251999/how-can-i-replace-each-newline-n-with-a-space-using-sed),
#  [2](https://superuser.com/questions/1729056/pattern-match-in-next-line-and-replace-using-sed)
# s/\n/\t/: Substitutes the newly appended newline character with a tab (\t). [1](https://askubuntu.com/questions/542160/replace-newline-with-tab-at-a-specific-location)
# To modify the file directly in-place, add the -i flag (e.g., sed -i '/PATTERN/{N;s/\n/\t/}' filename).
#  [1](https://www.youtube.com/watch?v=ZLzVG98i-64),
#  [2](https://www.cyberciti.biz/faq/linux-unix-sed-replace-newline/)
#
# Append this to create multiple of : '/PATTERN/{N;s/\n/\t/}'
sedJoinNewline='$/{N;s/\n/\t/};'
# Could use '\.' in place of '.' here, but it is unlikely to be needed.
sedVcfFiles="\
/.MAF.SNPList.vcf.gz$sedJoinNewline
/.MAF.SNPList.vcf.gz.csi$sedJoinNewline
/.MAF.vcf.gz$sedJoinNewline
/.MAF.vcf.gz.csi$sedJoinNewline
/.vcf.gz$sedJoinNewline
"
# This is the last file in each group, so don't join the newline trailing this.
# /.vcf.gz.csi$sedJoinNewline

# This gives a quick visual check that for each chromosome the expected files are present : 
#  .MAF.SNPList.vcf.gz
#  .MAF.SNPList.vcf.gz.csi
#  .MAF.vcf.gz
#  .MAF.vcf.gz.csi
#  .vcf.gz
#
# This doesn't interpret the chromosome name - it simply groups all files for
# each chromosome onto a single line, so it works for any species.
# It looks at files in the current directory, which is expected to be a VCF
# dataset directory in $pp/data/vcf/
#
# $chrPattern is used if defined; this avoids listing the non-chromosome files
# in the directory, which would otherwise break up the column pattern.
# Use 'unset chrPattern' if $chrPattern is already defined and you want to
# display all files.
#
# Usage :  cd $pp/data/vcf/dataset_123 ; checkVcf
function checkVcf()
{
  # This could be written with 1 ls, by appending "$chrPattern"* to the args array
  ([ -n "$chrPattern" ] && ls -d "${pd_lsArgs[@]}" "$chrPattern"* || ls "${pd_lsArgs[@]}" ) | sed "$sedVcfFiles"
}
pd_lsArgs=(-s )
# Use checkVcf() for all directories in $pp/data/vcf/
# This defines $chrPattern for each directory using guessChrPattern, which is
# quick enough and works in the datasets which we have loaded currently.
function checkVcfAll()
{
  cd $pp/data/vcf
  find . \! -name . -type d -print -prune | \
    while read pcva_dir; do
      echo "$pcva_dir";
      (cd "$pcva_dir" || return;
       chrPattern=$(guessChrPattern)
       # echo $chrPattern
       checkVcf
      );
    done
}

# Check for empty files in $pp/data/
function dataCheckEmptyFiles()
{
  (cd $pp/data && find . -size 0c -ls)
}

# Check that *.vcf.gz in the current directory are valid, tested by gunzip -t
# Return after the first failure.
function checkVcfGunzip()
{
  for vcfGz in *.vcf.gz
  do
    # bgzip -t is equivalent. gunzip is available outside the container.
    if gunzip -t "$vcfGz"
    then
      :
    else
      status=$?
      echo "check failed : gunzip -t $vcfGz"
      ls -ldF "$vcfGz"
      return $status
   fi
  done
}
# Check that .vcf.gz files in the current directory are valid, and have valid
# indexes (.csi).
# This function looks at files in the current directory, which is expected to be a VCF
# dataset directory in cd $pp/data/vcf/
# Usage :  cd $pp/data/vcf/dataset1 ; checkVcf
#
# Return 1 if checkVcfGunzip fails
function checkVcfDir()
{
  # check that .. is $pp/data/vcf
  if [ $(cd ..; pwd) != $pp/data/vcf ]
  then
    echo "This function should be used in a dataset directory within $pp/data/vcf/" 1>&2
    return;
  else
    checkVcfGunzip || return 1

    # Now check the index .csi file for each .vcf.gz
    # Use bcftools, which is available in the pretzel server api container.
    datasetId=$(basename $PWD)
    docker exec -i $composeName-api-1 bash <<EOF

cd \$mntData/vcf
cd $datasetId
for vcfGz in *.vcf.gz
do
  echo \$vcfGz
  bcftools index --stats \$vcfGz
done
EOF
fi

}

# vcfGzs=( $(ls | fgrep -v .csi) )
# ${vcfGzs[@]}

#-------------------------------------------------------------------------------

# Show the files in a Blast dataset directory, in columns so that it can be
# checked against the other dataset installations.
#
# @param datasetId
function listBlastDir()
{
  datasetId=$1
  # Blast database name, i.e. the prefix of all blast database files.
  databaseName=$(cat $datasetId.dbName)
  echo "$datasetId"$'\t'"$databaseName"
  ls -sAF $datasetId.dir | sed "s/$databaseName//g"
}
function listBlastDirs()
{
  cd $pp/data/blast/datasetId || return $?
  # Check that *.dir matches *.dbName
  ls -d *.dir | sed 's/.dir$//' > /tmp/dataset_dirs
  ls -d *.dbName | sed 's/.dbName$//'  > /tmp/dataset_dbNames
  diff -s /tmp/dataset_dirs /tmp/dataset_dbNames || echo 1>&2 'The above is a difference between the list of datasets which have .dir and .dbName in $pp/data/blast/datasetId'

  for datasetId in  $(cat /tmp/dataset_dirs)
  do
    listBlastDir $datasetId
  done | joinBlastFileList
}

# Join the lines of blast file names listing read from stdin so that files for
# each chromosome are on a single line, tab-separated.
# The last file suffix is .nto, so join all lines except the lines containing .nto.
#
# Related : checkVcf(), which uses sedJoinNewline / sedVcfFiles to join the VCF
# dir listing.
function joinBlastFileList()
{
  lastString='.nto'
  # Generated via this prompt : ... join the lines of text input on stdin, except for a line matching : /string$/
  # and then manually edited to refine the layout.
  #
  # Explanation (of generated code) :
  # if (/: \/string$/): Checks if the current line matches your pattern.
  # {print ""; print}: If it matches, it adds a newline to complete the previous joined string, and then prints the matching line on its own new line.
  # else {printf "%s", $0}: If it doesn't match, it uses printf without a trailing newline, effectively joining it to the previous text.
  # END {print ""}: Ensures the output ends with a final newline character.
  #
  # Modifications : prefix .nto with \t not \n;  don't join the ls summary output (total, size); prefix file lines with \t.
  #
  awk "{if (/$lastString"'$/) {printf "\t%s\n", $0} else if (/^ / || /[0-9] \./) {printf "\t%s", $0} else {print}} END {print ""}'
}


#-------------------------------------------------------------------------------
