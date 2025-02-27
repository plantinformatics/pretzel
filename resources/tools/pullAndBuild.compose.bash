source ~/.bash_custom
# which source-s other files including ~/scripts/functions_hosted.bash

#-------------------------------------------------------------------------------

# see note for a rolling log in pullAndBuild.bash
export LOG_GIT=~/log/build/git
logDateTime=$(date +'%Y%b%d_%H:%M')
# format e.g. : logDateTime=2018Dec10_03:00
echo logDateTime=$logDateTime

LOG_CRON=~/log/build/docker/cron
L=$LOG_CRON/$logDateTime

#-------------------------------------------------------------------------------

if [ -f ~/scripts/image_build.config.bash ]
then
  source ~/scripts/image_build.config.bash
fi
source ~/scripts/image_build.bash

# pb_build does : > $L
pb_build_feature
date
# use these as alternative to pb_build_feature to build when there is no new commit.
#set -x
# pb_set
#  cd $pretzel_build
# pb_build
#HEAD_unchanged=1

  baseName=plantinformaticscollaboration/$app


export PRETZEL_SERVER_IMAGE=$baseName:$PRETZEL_VERSION

# HEAD_unchanged is defined by pb_build_feature.
# if HEAD is changed (or HEAD_unchanged is undefined)
if [ "$HEAD_unchanged" -ne 0 ]
then
  pb_tag >> $L
  pb_compose_down_up >> $L
fi

#-------------------------------------------------------------------------------
