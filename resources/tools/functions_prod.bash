#-------------------------------------------------------------------------------
# functions related to building/running of the MMV application (Pretzel).
#-------------------------------------------------------------------------------

#-------------------------------------------------------------------------------
# Usage : source $PRETZEL_WORK_DIR/resources/tools/functions_prod.bash
# which is possibly done in ~/.bashrc, after '# User specific aliases and functions'
#
#-------------------------------------------------------------------------------
# x/emacs config
# Local Variables:
# mode : shell-script-mode
# End:
#-------------------------------------------------------------------------------

export PRETZEL_WORK_DIR=$(echo ${BASH_SOURCE-~/pretzel/resources} | sed 's,/resources,,')


# export access_token=
# export Authorization="Authorization: $access_token"
# export TOKEN=$access_token
export APIPORT=80

export API_HOST=localhost
export API_PORT_EXT=80

source ~/pretzel/resources/functions.bash
# These env echo-s cause problem for scp.
#echo CURL=$CURL;
#echo APIHOST=$APIHOST;
#echo URL=$URL

source ~/scripts/functions_hosted.bash

export URL_A=$APIHOST/api/Aliases/bulkCreate;
export URL_D=$APIHOST/api/Datasets/createComplete

export URL=$URL_D

export T1=Triticum_aestivum_IWGSC_RefSeq_v1.0
export DATA=~/data/wheat/Pretzel-LaunchData/extracted/unzipped

function dockerContainer() {
  image=$1;
  docker ps --format "{{.ID}}\t{{.Image}}" | sed -n "s/	$image//p"
}
DIM=$(dockerContainer mongo)


#-------------------------------------------------------------------------------
# These will move to pretzel/resources/functions.bash


# Set the token used by uploadData()
function setToken() {
  # only 1 of these abbreviations is required, will simplify ...
  export access_token=$1;
  export Authorization="Authorization: $access_token";
  export TOKEN=$access_token
}

# equiv : -H , --header
# because of quoted strings in array, use "${H_json[@]}"
export H_json=( -H "Content-Type: application/json" -H "Accept: application/json" )

# not used :  --cookie @cookies.txt 

function uploadData() { file=$1;
"$CURL"  "${H_json[@]}"    --url $URL  -H "$Authorization"   --data-binary @$file
}

# Same as uploadData()
function uploadC() { curl -X POST "${H_json[@]}"  -d @${F}  "http://localhost:$APIPORT/api/Datasets/createComplete?access_token=${TOKEN}" ; }

# Use uploadData().  Echo the filename, and show the result on the same line.
function uploadDataList() {
  for i in $* ; do echo -en '\n' $i '\t'; uploadData $i ; done
}


function deleteDataset() {
  file=$1;
  name=$(head $file | sed -n 's/ *"name": "\(.*\)",/\1/p')
  echo name=$name
  if [ -z "$name" ]
  then
    return 1
  else
    curl -X DELETE --header 'Accept: application/json'   -H "$Authorization"  --url $APIHOST/api/Datasets/$name
  fi
}
function replaceDataset() {
  file=$1;
  deleteDataset $file && \
  uploadData $file
}

#-------------------------------------------------------------------------------

# usage : beServer
#
# refs :
# backend/.env:2:API_PORT_EXT=5000
# backend/test/helpers/environment.js:5:process.env.API_PORT_EXT = 5000;
# doc/notes/docker_setup.md:
#   PORT_API_EXT=5000
#   GM_API_URL=localhost:5000
#   http://localhost:5000/Geneticmaps
# frontend/config/environment.js:7:    apiHost: 'http://localhost:5000',
#
# see also $pA/tools/functions_app.bash: beServer()
#
function beServer()
{
cd ~/pretzel && nohup sudo	\
 `which node`	\
 ./app/server/server.js &	\
}

#-------------------------------------------------------------------------------

# make a gzipped backup of ~/pretzel/nohup.out in ~/log/nohup_out/,
# with filename based on modification timestamp of file.
#
# Use this after stopping the backend server (e.g. sudo pkill node)
# and starting another with beServer.
#
# usage : backupPretzelNohup
#
function backupPretzelNohup() {
  cd ~/pretzel
  timeStamp=$(find nohup.out -printf '%TY%Tb%Td_%TH:%TM')
  ls -gG nohup.out
  gzip nohup.out
  ls -gG nohup.out.gz
  mv -i nohup.out.gz ~/log/nohup_out/$timeStamp.gz
}
#-------------------------------------------------------------------------------
