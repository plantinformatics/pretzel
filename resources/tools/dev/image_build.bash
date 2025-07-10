#!/usr/bin/env bash

# This script file is designed to be sourced - it defines bash functions which
# can then be used on the command line or in cron etc.
# If this script file is executed, it will perform the main bash function, which
# builds an image for a release.

#-------------------------------------------------------------------------------

# These are required by each of the functions in this file
unused_var=${pretzel_build:=~/pretzel/../pretzel_build}
export pretzel_build
export GIT_PAGER=cat
export DOCKER_BUILDKIT=1
# To build again on the same day, append a unique suffix, e.g.
# logDate=${logDate}b
# To update logDate in a shell older than 1 day, source this file again.
logDate=$(date +%Y%b%d);
echo $logDate;

#-------------------------------------------------------------------------------

# These vars are set by other functions; use pb_set() after creating a new shell
# on the same day.
pb_set() {
  app=pretzel
  baseName=plantinformaticscollaboration/$app
  # can be overridden by pb_build_release
  export PRETZEL_VERSION
  echo PRETZEL_VERSION=${PRETZEL_VERSION=v$logDate}
  image=$app:$PRETZEL_VERSION
  LB=~/log/build/docker/$logDate
  L=~/log/compose/$stage/$logDate
  export PRETZEL_SERVER_IMAGE=$baseName:$PRETZEL_VERSION
}

# Show the environment variables set by pb_set() and other functions.
pb_show() {
  echo logDate=$logDate, image=$image, app=$app, PRETZEL_VERSION=$PRETZEL_VERSION, LB=$LB, L=$L, PRETZEL_SERVER_IMAGE=$PRETZEL_SERVER_IMAGE
}

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
  branch=$(git status  --porcelain -b | head -1  | sed 's/^## //;s/\.\.\..*//')
  if [ -n "$pretzel_branch" -a \( $branch != $pretzel_branch] \) ]
  then
    # git fetch -v . origin/$pretzel_branch:$pretzel_branch
    git checkout $pretzel_branch
  fi
  # manual operation
  # git checkout feature/guiChangesLeftPanel
  # follow this with : pb_build_feature
}

# pretzel build of a feature branch : pull, build and label with date-stamp
function pb_build_feature() {
  app=pretzel
  export PRETZEL_VERSION=v$logDate

  cd $pretzel_build
  HEAD_old=$(git rev-parse HEAD)
  git pull --ff-only || return
  HEAD_new=$(git rev-parse HEAD)
  [ "$HEAD_old" = "$HEAD_new" ]
  HEAD_unchanged=$?
  # build if $build_if_pulled is true or unchanged is false (true is 0)
  # build_if_pulled may be undefined so use string comparison (-eq and -ne
  # require a number).  HEAD_unchanged is defined.
  if [ \( "$build_if_pulled" =  0 \) -o \( "$HEAD_unchanged" -ne 0 \) ]
  then
    pb_build
  fi
}

# pretzel build, assuming that git work-tree has the desired version checked out
# build and label with $PRETZEL_VERSION
function pb_build() {
  image=$app:$PRETZEL_VERSION
  LB=~/log/build/docker/$logDate
  time nohup docker build  ${build_arg_ROOT_URL[@]} -t $image . > $LB
}
# monitor this with :
#  tail $LB

#-------------------------------------------------------------------------------

# from notes aws 'Wed Dec  4 06:00:41 PM AEDT 2024'

# pretzel build of master, assuming worktree has a feature branch checked out
# pull, build and label with version from package.json, e.g. v3.1.0
function pb_build_release() {
  cd $pretzel_build

  export pretzel_branch=master
  branch=$(git status  --porcelain -b | head -1  | sed 's/^## //;s/\.\.\..*//')
  if [ -n "$pretzel_branch" -a \( "$branch" != "$pretzel_branch" \) ]
  then
    set -x
    # May integrate with pb_fetch(); just this line is different.
    git fetch -v . origin/$pretzel_branch:$pretzel_branch || return
    git checkout $pretzel_branch
    set +x
  fi

  git pull --ff-only || return

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
  # instead pass pretzel_branch to pb_fetch

  # pb_build_feature does pull, which has no effect after above fetch & checkout
  pb_build_feature
}

#-------------------------------------------------------------------------------

# for a feature branch, with datestamp tag, :latest is not required
function pb_tag() {
  docker tag $image $baseName:$PRETZEL_VERSION
  docker image inspect $image | jq '.[] | .RepoTags'
}

#-------------------------------------------------------------------------------

unused_var=${Dc:=~/pretzel-hosting/aws-instances/config/docker-compose}
export Dc
stage=dev
# or stage=prod

L=~/log/compose/$stage/$logDate

#-------------------------------------------------------------------------------

pb_compose_down_up() {
  docker compose --progress=plain   --file $Dc/docker-compose.$stage.yaml  --env-file $Dc/pretzel.compose.$stage.env down
  nohup docker compose --progress=plain   --file $Dc/docker-compose.$stage.yaml  --env-file $Dc/pretzel.compose.$stage.env  up > $L &
}

#-------------------------------------------------------------------------------

# Backup the existing container logs
pb_backup_logs() {
  # ls -gGArtF ~/log/compose/$stage | tail
  for i in api database blastserver; do docker logs pretzel-$stage-$i-1 >& ~/log/compose/$stage/$i.$logDate; done
  ls -gGArtF ~/log/compose/$stage | tail
}

# Build Pretzel Release
#
pb_build_and_release() {

  echo $stage
  stage=prod

  if df_available_gt /mnt/dockerBuild 10
  then
    :
  else
    echo 1>&2 Insufficient space on docker build volume.
    df -h /mnt/dockerBuild
    return 1
  fi

  # Fetch the latest commits
  cd $pretzel_build
  git status

  if [ $(git branch --show-current) = master ]
  then
    git pull
  else
    git fetch -v . origin/master:master
    git checkout master
  fi


  # Configure
  echo app=$app
  app=pretzel
  pb_set
  pb_show


  # Change the date-stamped version to a Release version
  export PRETZEL_VERSION=v$(sed -n 's/",$//;s/^  "version": "//p' package.json)
  echo $PRETZEL_VERSION
  export PRETZEL_SERVER_IMAGE=$baseName:$PRETZEL_VERSION
  echo PRETZEL_SERVER_IMAGE=$PRETZEL_SERVER_IMAGE

  # Build the Docker image
  pb_build_release

  # Check the result
  docker image ls | head
  # set +x
  pb_tag
  echo Dc=$Dc
  echo logDate=$logDate
  echo stage=$stage

  stage=prod
  # Backup the existing container logs
  pb_backup_logs

  echo $L
  docker ps
  docker logs --tail 30 pretzel-prod-api-1
  date

  # Install the built release
  pb_compose_down_up

  for tag in $PRETZEL_VERSION latest; do docker push $baseName:$tag; done
}

#-------------------------------------------------------------------------------

# Determine if the disc space available on the given volume is greater than the given
#
# @param df_volume	absolute path of volume, e.g. /mnt/dockerBuild
# @param df_GB_threshold	minimum GB of space required, e.g. 10
# (calculation currently x 10e6 instead of x 1048576 )
# @return true (0) if there is sufficient space
#
# Usage example : df_available_gt /mnt/dockerBuild 10; echo $?
function df_available_gt() {
  df_volume=$1
  df_GB_threshold=$2  # or  $(expr $2 \* 1024 \* 1024), instead of "000000"
  available=$(df --output=avail $df_volume | tail -n +2)
  [ -n "$available" -a \( "$available" -gt ${df_GB_threshold}000000 \) ]
}


#-------------------------------------------------------------------------------

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
