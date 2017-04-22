#!/bin/bash

# Usage : source resources/functions.bash

#-------------------------------------------------------------------------------

# Usage e.g. : 
# cd markerMapViewer/Dav127 && load_test_data
# or
# cd markerMapViewer/Dav127 && load_test_data_file resources/example_map?.json
#
# load minimal sample data into the db
function load_test_data_file()
{
    for mapJsonFileName in $*
    do
    curl -X POST \
	 -H "Accept: application/json" -H "Content-type: application/json" \
	 -d @$mapJsonFileName \
	 localhost:1776/geneticmaps
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
