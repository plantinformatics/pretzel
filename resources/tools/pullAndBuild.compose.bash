source ~/.bash_custom
# which source-s other files including ~/scripts/functions_hosted.bash

#-------------------------------------------------------------------------------

# see note for a rolling log in pullAndBuild.bash
export LOG_GIT=~/log/build/git
logDateTime=$(date +'%Y%b%d_%H:%M')
# format e.g. : logDateTime=2018Dec10_03:00
echo logDateTime=$logDateTime

#-------------------------------------------------------------------------------

source ~/scripts/image_build.bash

pb_build_feature
# pb_set

export PRETZEL_SERVER_IMAGE=$baseName:$PRETZEL_VERSION

# HEAD_unchanged is defined by pb_build_feature.
# if HEAD is changed (or HEAD_unchanged is undefined)
if [ "$HEAD_unchanged" -ne 0 ]
then
  pb_tag
  pb_compose_down_up
fi

#-------------------------------------------------------------------------------
