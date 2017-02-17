#!/bin/bash

# Usage : source resources/functions.bash
# cd markerMapViewer/Dav127 && load_test_data

# load minimal sample data into the db
function load_test_data()
{
    curl -X POST \
	 -H "Accept: application/json" -H "Content-type: application/json" \
	 -d @resources/example_map1.json \
	 localhost:1776/geneticmaps

    curl -X POST \
	 -H "Accept: application/json" -H "Content-type: application/json" \
	 -d @resources/example_map2.json \
	 localhost:1776/geneticmaps

}
# Expected output :
# { geneticmap: { name: 'MyMap1', chromosomes: [ [Object] ] } }
# {"geneticmap":{"_id":"589b17fcff0f2b4ba113deea","name":"MyMap1","chromosomes":[{"name":"MyChr","markers":[{"name":"markerA","position":1},{"name":"markerB","position":1.5}]}]}}
: <<'END'
{ geneticmap: { name: 'MyMap1', chromosomes: [ [Object] ] } }
{"geneticmap":{"_id":"589be243ff0f2b4ba113deee","name":"MyMap1","chromosomes":[{"name":"MyChr","markers":[{"name":"markerA","position":1},{"name":"markerB","position":1.5}]}]}}{ geneticmap: { name: 'MyMap2', chromosomes: [ [Object] ] } }
{"geneticmap":{"_id":"589be243ff0f2b4ba113deef","name":"MyMap2","chromosomes":[{"name":"MyChr","markers":[{"name":"markerA","position":0},{"name":"markerB","position":1.3}]}]}}
END

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
