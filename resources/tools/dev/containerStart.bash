#!/usr/bin/env bash

# ------------------------------------------------------------------------------

# from pretzel/README.md :  [Docker on linux](#docker-on-linux)

mkdir -p ~/mongodata \
 && docker run --name mongo --detach --volume ~/mongodata:/data/db --net=host mongo:5.0 \
 && until $(curl --silent --output /dev/null localhost:27017 || \
    [ $(docker inspect -f '{{.State.Running}}' mongo) = "false" ]); do printf '.'; sleep 1; done \
 && docker run --name pretzel --detach --net=host plantinformaticscollaboration/pretzel:stable  \
 && until $(curl --silent --output /dev/null localhost:3000 || \
    [ $(docker inspect -f '{{.State.Running}}' pretzel) = "false" ] ); do printf '.'; sleep 1; done \
 && docker logs pretzel


# ------------------------------------------------------------------------------

# This script file consists of bash function definitions (above), and commands (below) to run one of those functions.
# If the script is sourced then the function definitions are added to the shell.
# If the script is executed then the below commands are executed.
#
# Test if this script is executed or sourced.
# The following actions are not performed if it is sourced;  this enables this script to be used to define the function in an interactive bash shell
if (return 0 2>/dev/null); then : ; else
# --------------------------------------


# --------------------------------------
fi
