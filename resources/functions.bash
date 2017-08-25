#!/bin/bash

# Usage : source resources/functions.bash

#-------------------------------------------------------------------------------
#
API_PROTO=http
API_HOST=localhost
API_PORT=3000
# Context path
API_PATH_PREFIX=api
API_PATH_GM=Geneticmaps
# API_PATH_GM=geneticmaps
# GM_API_URL=localhost:1776
#-------------------------------------------------------------------------------

# Usage e.g. : 
# cd markerMapViewer/Dav127 && load_test_data
# or
# cd markerMapViewer/Dav127 && load_test_data_file resources/example_map?.json
#
# load minimal sample data into the db
function load_test_data_file()
{
    # allow caller to provide $GM_API_URL directly
    unused=${GM_API_URL=$API_PROTO://$API_HOST:$API_PORT/$API_PATH_PREFIX}
    if [ -n "$API_ACCESS_TOKEN" ]
    then
	URL_VARIABLES="?access_token=$API_ACCESS_TOKEN"
    fi
    if [ -n "$API_Authorization" ]
    then
	EXTRA_ARGS=("-H" "Authorization:$API_Authorization")
    fi
    for mapJsonFileName in $*
    do
    curl -X POST \
	 -H "Accept: application/json" -H "Content-type: application/json" \
	 ${EXTRA_ARGS[*]}	\
	 -d @$mapJsonFileName \
	 "$GM_API_URL/$API_PATH_GM/upload$URL_VARIABLES"
    done
}
function load_test_data()
{
    load_test_data_file resources/example_map1.json resources/example_map2.json
}
# Expected output :
: <<'Expected_output_delimiter'
Created new geneticmap
{
  "name": "MyMap1",
  "chromosomes": [
    {
      "name": "MyChr",
      "markers": [
        {
          "name": "markerA",
          "position": 1,
          "id": "58a67811d4e31c6515525eca"
        },
        {
          "name": "markerB",
          "position": 1.5,
          "id": "58a67811d4e31c6515525ec9"
        }
      ],
      "id": "58a67811d4e31c6515525ec8"
    }
  ],
  "id": "58a67811d4e31c6515525ec7"
}Created new geneticmap
{
  "name": "MyMap2",
  "chromosomes": [
    {
      "name": "MyChr",
      "markers": [
        {
          "name": "markerA",
          "position": 0,
          "id": "58a67812d4e31c6515525ece"
        },
        {
          "name": "markerB",
          "position": 1.3,
          "id": "58a67812d4e31c6515525ecd"
        }
      ],
      "id": "58a67812d4e31c6515525ecc"
    }
  ],
  "id": "58a67812d4e31c6515525ecb"
}

Expected_output_delimiter

#-------------------------------------------------------------------------------
# Create marker position data for loading via load_test_data_file;
# this is the content of {geneticmap { chromosomes {[ markers [ ... ] ]} }}.
# Input is 2 lines: markerName-s then corresponding marker positions.
# markerName-s are alphanumeric
# marker positions are list of real numbers
# values are separated by whitespace.
#
# A trailing comma is placed after each output;  the last one should be removed if it is placed before }.
# Usage e.g.
# (these examples are outdated by the addition of aliases; if loader requires aliases then these can be
#  changed, otherwise markerPositions() can take an option to enable aliases. )
#   ( echo marker{A,B,C,D,E,F} ; echo 0.{1,2,3,4,5,6} ) | markerPositions
#   ( echo marker{G,H,I,J,K,L} ; echo 0.{7,8,9} 1.{0,1,2}) | markerPositions
#
# a separate map, related to the above with a simple pattern :
#   (head -9 resources/example_map4.json | sed s/MyMap4/MyMap5/;
#   ( echo marker{B,C,D,E,F,A} ; echo 0.{1,2,3,4,5,6} ) | markerPositions
#   ( echo marker{L,G,H,I,J,K} ; echo 0.{7,8,9} 1.{0,1,2}) | markerPositions
#   tail -6 resources/example_map4.json) > resources/example_map5.json
#
# Examples with aliases :
#  see aliases_6,7
#
markerPositions()
{
    read -a markerNames
    read -a markerPositions
    read -a markerAliases
    len=${#markerNames[@]}
    lastIndex=`expr $len - 1`

    for i in 0 `yes '' | head -$lastIndex | cat -n`
    do
	ma=${markerAliases[$i]}
	if [ -z "$ma" ]
	then
	    aliasGroups=
	else
	    aliasGroups=\"`eval echo $ma | sed 's/ /","/g'`\"
	fi
	echo "\
          {
          \"name\": \"${markerNames[$i]}\",
          \"position\": ${markerPositions[$i]},
          \"aliases\": [$aliasGroups]
          },"
    done
}

# used as input to markerPositions (the 3rd line - aliases)
# Generate alias groups with 0,1,2,3,4,5 aliases respectively.
# usage :
# echo 'marker{a,b,c,d,e,f}' | aliasGroups
# The input contains {,} which is expanded in markerPositions.
aliasGroups()
{
    read -a markerNames
    (
	while echo "$markerNames" | fgrep -q , 
	do
	    echo "$markerNames"
	    markerNames=`echo $markerNames | sed "s/,[A-Za-z]}/}/"`
	done
	markerNames=`echo $markerNames | sed "s/{//g;s/}//g"`
	echo "$markerNames"
	echo
    ) | tac | tr '\n' ' '
    echo
}

# remove ',' from the end of the last line.
# JSON expects no comma before ].
# markerPositions generates a comma after each repeated part (marker).
function removeLastLineComma()
{
    sed '$s/^\( *}\),$/\1/'
}

example_template=resources/example_map4.json
# example_map{6,7}.json are based on example_map{4,5}.json, with alias groups added to each marker
function aliases_6()
{
    mapN=6
    (head -9 $example_template | sed s/MyMap4/MyMap$mapN/;
     # omitting from alias groups : ,c and ,j
     # This is because we want an empty alias group.
     ( echo marker{A,B,C,D,E,F} ; echo 0.{1,2,3,4,5,6} ; echo 'marker{a,b,d,e,f}' | aliasGroups ) | markerPositions
     ( echo marker{G,H,I,J,K,L} ; echo 0.{7,8,9} 1.{0,1,2} ; echo 'marker{g,h,i,k,l}' | aliasGroups ) | markerPositions | removeLastLineComma
     tail -5 $example_template)  > resources/example_map$mapN.json
}

function aliases_7()
{
    mapN=7
    (head -9 $example_template | sed s/MyMap4/MyMap$mapN/;
     # omitting from alias groups : ,C and ,J
     ( echo marker{b,c,d,e,f,a} ; echo 0.{1,2,3,4,5,6} ; echo 'marker{B,D,E,F,A}' | aliasGroups ) | markerPositions
     ( echo marker{l,g,h,i,j,k} ; echo 0.{7,8,9} 1.{0,1,2} ; echo 'marker{L,G,H,I,K}' | aliasGroups ) | markerPositions | removeLastLineComma
     tail -6 $example_template) > resources/example_map$mapN.json
}


#-------------------------------------------------------------------------------
# Extract data and load from :
# http://onlinelibrary.wiley.com/doi/10.1111/tpj.13436/full
# DOI 4: https://doi.org/10.5447/IPK/2016/58 :
#  2082883 Jun 30 14:57 Updated version (v2) of the Rye Genome Zipper.zip :
# schmutzr@IPK-GATERSLEBEN.DE/Updated version (v2) of the Rye Genome Zipper/DATA:
#  14391279 Aug  3  2016 RyeGenomeZipper_v2_chromosomes.tab
#
# Filter the data : markers which do not repeat appear in only 1 map, so to
# get lines between maps, select markers which are repeated.
#
# Usage : DOWNLOADS=(path containing the .zip) MMV=.../Dav127  loadRepeats
function loadRepeats()
{
    cd /tmp

    unzip ${DOWNLOADS-~/Downloads}/'Updated version (v2) of the Rye Genome Zipper.zip' 'schmutzr@IPK-GATERSLEBEN.DE/Updated version (v2) of the Rye Genome Zipper/DATA/RyeGenomeZipper_v2_chromosomes.tab'
    export RGZ_data=$PWD/'schmutzr@IPK-GATERSLEBEN.DE/Updated version (v2) of the Rye Genome Zipper/DATA'

    export RGZ="$RGZ_data/RyeGenomeZipper_v2_chromosomes.tab"
    tr '\t' '\n' < "$RGZ" | grep "^AK" | sort > R_AK
    sort  R_AK | uniq -d > R_AK_repeats

    mkdir out_r
    cd out_r

    fgrep -f ../R_AK_repeats  "$RGZ" | $MMV/resources/tools/tab2json.pl

    mkdir log
    for i in ?R ; do load_test_data_file $i > log/$i; done
}

#-------------------------------------------------------------------------------

# work-tree for github.com/Seanli52/Dav127
# used by emberServerStart()
export MMV=~/new/projects/agribio/markerMapViewer/Dav127

#-------------------------------------------------------------------------------
# start and stop ember server

function emberServerStop_2()
{
    kill %?'ember server'
}
# Same as emberServerStop(), using sed instead of jobspec to match the job - would be useful if
# a more complex regular expression is required which %? cannot match.
function emberServerStop_2()
{
    eval `jobs -l | sed -n 's/^\[\([0-9][0-9]*\).*ember server.*/kill %\1/p' `
}

function emberServerStart()
{
    cd $MMV/frontend && ember server &
}
function emberServerRestart()
{ emberServerStop; sleep 5; emberServerStart; }

#-------------------------------------------------------------------------------

tmpDist=/tmp/don/ag/mmv/dist.zip
tmpDistDir=`echo $tmpDist | sed s,/dist.zip,,`
# Give .js files a suffix to exclude them from the build.
unusedSuffix=not_in_build

# Make a distribution package, which can be served with a static http file server
function distZip()
{
    [ -d $tmpDistDir ] || mkdir -p "$tmpDistDir" || return;

    if [ ! -d frontend/dist ];  then echo "cd to Dav127" 1>&2; return 2; fi

    (cd frontend/dist && swapApplicationHost production && zip -qr $tmpDist * && ls -gG $tmpDist)
}

# wait for broccoli to build the dist.zip
function waitBuildDistZip()
{
    # cd within () to avoid changing cwd of caller
    (
    if [ \! -d frontend/app -a -d ../../../frontend/app ]
    then
	cd ../../..
    fi
    waitBuildDistZipMsg=
    while find frontend/app -name \*.js -newer frontend/dist/assets/ember-test.js -print | fgrep frontend/ && sleep 10
    do
	:
	if [ -z "waitBuildDistZipMsg" ]
	then
	    waitBuildDistZipMsg=1
	    echo waiting for dist/ to be built 1>&2
	fi
    done
    )
}

# @param 1	devel or production
function swapApplicationHost()
{
    (
    cd ../app/adapters/
    if [ ! -f application.js ];  then echo "frontend/app/adapters/application.js expected" 1>&2; return 2; fi

    context=$1
    case $context in
	devel)
	    # sleep 60 to wait for dist to build after swapping application.js
	    [ -f application.devel.js.$unusedSuffix ] && mv -i application.js application.production.js.$unusedSuffix && mv -i application.devel.js.$unusedSuffix application.js && waitBuildDistZip; 
	    grep '^  *host' application.js | fgrep dirac
	    return `expr 1 - $?`
	    ;;
	production)
	    [ -f application.production.js.$unusedSuffix ] && mv -i application.js application.devel.js.$unusedSuffix && mv -i application.production.js.$unusedSuffix application.js && waitBuildDistZip; 
	    grep '^  *host' application.js | fgrep -v dirac
	    return `expr 1 - $?`
	    ;;
	*)	echo Usage : $0 devel \| production
	    ;;
	esac    
    )
}
#-------------------------------------------------------------------------------
