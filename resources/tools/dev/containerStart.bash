#!/usr/bin/env bash

# ------------------------------------------------------------------------------

# from pretzel/README.md :  [Docker on linux](#docker-on-linux)

mongoContainerName=mongo_tmp
pretzelContainerName=pretzel_tmp

function containerStart() {
mkdir -p ~/Databases/Pretzel/mongodata \
   && ( ( docker ps | fgrep $mongoContainerName ) || docker run --name $mongoContainerName --detach --volume ~/Databases/Pretzel/mongodata:/data/db --net=host mongo:5.0 ) \
   && until $(curl --silent --output /dev/null localhost:27017 || \
[ $(docker inspect -f '{{.State.Running}}' $mongoContainerName) = "false" ]); do printf '.'; sleep 1; done \
   && docker run --name $pretzelContainerName ${PRETZEL_DOCKER_ENV[@]} --detach --net=host plantinformaticscollaboration/pretzel:$PRETZEL_VERSION  \
   && until $(curl --silent --output /dev/null localhost:3000 || \
[ $(docker inspect -f '{{.State.Running}}' $pretzelContainerName) = "false" ] ); do printf '.'; sleep 1; done  && docker logs $pretzelContainerName

}



# ------------------------------------------------------------------------------

# This script file consists of bash function definitions (above), and commands (below) to run one of those functions.
# If the script is sourced then the function definitions are added to the shell.
# If the script is executed then the below commands are executed.
#
# Test if this script is executed or sourced.
# The following actions are not performed if it is sourced;  this enables this script to be used to define the function in an interactive bash shell
if (return 0 2>/dev/null); then : ; else
# --------------------------------------

unused_var=${PRETZEL_VERSION=stable}
export PRETZEL_VERSION
echo PRETZEL_VERSION=$PRETZEL_VERSION

# Environment variables for Pretzel server
# e.g. PRETZEL_DOCKER_ENV=(-e handsOnTableLicenseKey=non-commercial-and-evaluation)

containerStart

# --------------------------------------
fi
