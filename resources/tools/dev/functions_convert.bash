#!/bin/bash

# Usage : source pretzel/resources/tools/dev/functions_convert.bash


# sp=~/pretzel/resources/tools/dev/snps2Dataset.pl;
# commonName=Chickpea;
# shortName=WGS_SNP;
# platform=WGS_SNP;
# parentName=...

# genBankRename= sed script of the form :
#   s/gi|442654316|gb|CM001764.1|/Ca1/
#   s/gi|442654315|gb|CM001765.1|/Ca2/

# setup :
# mkdir out out_json
# for i in *.xlsx; do echo $i; ssconvert -S "$i" out/"$i.%s.csv"; done


function snp1() {
  echo "$i"; <"$i" tail -n +2 | sed -f $genBankRename |  sort -t, -k 2  |  \
  $sp -d "$parentName.$datasetName" -s "$shortName" -p $parentName -n"$parentName:$platform" -c "$commonName"  	\
    >  ../out_json/"$i".json ; ls -gG ../out_json/"$i".json
}
function datasetName2shortName() {
  sed 's/_Submission//ig;s/_Gydle//ig;s/SSRs/SSR/;s/SNPs/SNP/;s/^CP_//;s/FieldPea//;s/FABABEAN_//;s/FABA_//;s/^FB_//;s/_FP$//;s/^Len_//;s/Lentil_//;s/inhouse_Pretzel//;s/ (2)//' ; }

function fileName2DatasetName() {
  sed -n 's/\.csv$//;s/[ _]*Linkage[ _]*map[_ ]*//ig;s/Pretzel_submission_//ig;s/ $//;s/ map$//i;s/\([^ ls]\)[xX]\([^ ls]\)/\1 x \2/g;s/ x / x /ig;s/.*\.xlsx\.//p;'; }

# env var $snpFile is the name of the file which contains SNPs which associate the markers in this map file with chromosome names
# See also mapChrsCN()
# usage e.g. snpFile=*mission*CP_EST_SNP-OPA*
function mapChrs() {
  lm_c=$( awk -F, ' { print $2; }'  "$i" | uniq)
  datasetName=$( echo "$i" | fileName2DatasetName );  echo "$datasetName	$i"; 
  mkdir chrSnps/"$datasetName"
  if [ -f chrSnps/"$datasetName".chrCount ]
  then
      rm chrSnps/"$datasetName".chrCount
  fi
  for j in $lm_c; do echo $j; awk -F, "/,$j,/ {print \$1;}" "$i" >chrSnps/"$datasetName"/$j; done
  for j in $(cd chrSnps/"$datasetName"; ls ); do suffix=$(echo $j | sed -n "s/.*\(\..*\)/\1/p"); fgrep -f "chrSnps/$datasetName/$j" $snpFile |  sed -f $genBankRename | awk -F, '{a[$2]++;} END {for (i in a) print a[i], i;}' | sort -n -r | head -1 | tee -a chrSnps/"$datasetName".chrCount | awk ' {printf("s/,%s,/,%s%s,/\n", "'$j'", $2, "'$suffix'"); }' ; done > chrSnps/"$datasetName".chrRename.sed
}

function map1() {
  j=$(echo "$i" | fileName2DatasetName);  \
  datasetName=$j;
  echo "$j"; <"$i"  sed -f chrSnps/"$datasetName".chrRename.sed |   $sp -d "$j" -p '' -n 'SNP_OPA' -c "$commonName" -g  >  ../out_json/"$i".json ; ls -gG ../out_json/"$i".json 
}


# Convert a linkage / genetic map from csv to Pretzel json.
# Similar to mapChrs() except the column order here is assumed to be 
# columnsKeyString="chr name pos"
# i.e. chr is in $1, name is in $2 (awk)
# This also impacts the regexp /^$j
#
# snpFile=*mission*CP_EST_SNP-OPA*
# snpFile=*CP_GBS-TC*
function mapChrsCN() {
  lm_c=$( awk -F, ' { print $1; }'  "$i" | uniq)
  datasetName=$( echo "$i" | fileName2DatasetName );  echo "$datasetName	$i"; 
  mkdir chrSnps/"$datasetName"
  for j in $lm_c; do echo $j; awk -F, "/^$j,/ {print \$2;}" "$i" >chrSnps/"$datasetName"/$j; done
  for j in $(cd chrSnps/"$datasetName"; ls L*); do suffix=$(echo $j | sed -n "s/.*\(\..*\)/\1/p"); fgrep -f "chrSnps/$datasetName/$j" $snpFile |  sed -f $genBankRename | awk -F, '{a[$2]++;} END {for (i in a) print a[i], i;}' | sort -n -r | head -1 | awk ' {printf("s/^%s,/%s%s,/\n", "'$j'", $2, "'$suffix'"); }' ; done > chrSnps/"$datasetName".chrRename.sed
}

function CP_GM() {
  export columnsKeyString="name chr pos";
  for i in *inkage*_LasseterxICC3996*  ; do mapChrs; done

  export columnsKeyString="chr name pos";
  for i in *inkage*_SonalixGenesis*  ; do mapChrsCN; done

  export columnsKeyString="chr name pos";
  for i in *inkage*_SonalixGenesis*  ; do map1; done

  export columnsKeyString="name chr pos";
  for i in *inkage*_LasseterxICC3996*  ; do map1; done

}
