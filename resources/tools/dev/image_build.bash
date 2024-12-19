#!/usr/bin/env bash

# This script file is designed to be sourced - it defines bash functions which
# can then be used on the command line or in cron etc.
# If this script file is executed, it will perform the main bash function, which
# builds an image for a release.

#-------------------------------------------------------------------------------

# These are required by each of the functions in this file
export pretzel_build=~/pretzel/../pretzel_build
export GIT_PAGER=cat
export DOCKER_BUILDKIT=1
# To build again on the same day, append a unique suffix, e.g.
# logDate=${logDate}b
# To update logDate in a shell older than 1 day, source this file again.
logDate=$(date +%Y%b%d);
echo $logDate;

#-------------------------------------------------------------------------------

# from notes aws 'Fri Nov 29 08:38:18 AM AEDT 2024'

# pretzel build : fetch
#
# Use this if there may be local edits in the work-tree, preventing git pull, or
# if you plan to checkout a different branch in the work-tree.
function pb_fetch() {
  cd $pretzel_build;
  git status -sb
  git fetch
  # manual operation
  # git checkout feature/guiChangesLeftPanel
  # follow this with : pb_build_feature
}

# pretzel build of a feature branch : pull, build and label with date-stamp
function pb_build_feature() {
  cd $pretzel_build
  git pull --ff-only || return
  app=pretzel
  export PRETZEL_VERSION=v$logDate
  pb_build
}

# pretzel build, assuming that git work-tree has the desired version checked out
# build and label with $PRETZEL_VERSION
function pb_build() {
  image=$app:$PRETZEL_VERSION
  LB=~/log/build/docker/$logDate
  time nohup sudo docker build -t $image . > $LB  &
}
# monitor this with :
#  tail $LB

#-------------------------------------------------------------------------------

# from notes aws 'Wed Dec  4 06:00:41 PM AEDT 2024'

# pretzel build of master, assuming worktree has a feature branch checked out
# pull, build and label with version from package.json, e.g. v3.1.0
function pb_build_release() {
  cd $pretzel_build
  git pull --ff-only || return
  git fetch
  set -x
  git fetch -v . origin/master:master || return
  git checkout master
  set +x
  app=pretzel
  export PRETZEL_VERSION=v$(sed -n 's/",$//;s/^  "version": "//p' package.json)
  pb_build
}


#-------------------------------------------------------------------------------

# from notes aws 'Fri Dec  6 10:57:20 AM AEDT 2024'

# pretzel build of a feature branch, assuming worktree does not have it checked out.
function pb_build_feature_change() {
  cd $pretzel_build
  git fetch
  # manual operation;  branch could be guessed from fetch trace
  # git checkout feature/guiChangesMessages

  # pb_build_feature does pull, which has no effect after above fetch & checkout
  pb_build_feature
}


#===============================================================================

# This script file consists of bash function definitions (above), and commands (below)
# to build container images for pretzel.
# If the script is sourced then the function definitions are added to the shell.
# If the script is executed then the below commands are executed :
# i.e. pull and build in the pretzel work-tree

# Test if this script is executed or sourced.
# Those actions are not done if it is sourced;  this enables this script to be used to define the function deploy in an interactive bash shell
if (return 0 2>/dev/null); then : ; else

#---------------------------------------

# pb_build_feature is a safer default action than pb_build_release which updates
# master and does checkout
pb_build_feature

#---------------------------------------

fi

#===============================================================================
