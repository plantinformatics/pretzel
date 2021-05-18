#-------------------------------------------------------------------------------
# functions related to monitoring user signup and confirmation.
#-------------------------------------------------------------------------------

# usage : 
#  source ~/scripts/functions_monitor.bash
#  initialise : 
#   setupMonitor
#  regular / cron :
#   accessDiffPost

# Environment vars used :
#  $SERVER_NAME
#  $DB_NAME	in signupReport() in mongo_admin.bash (defaults to admin)
#  $DIM		in signupReport()
#  $slack_postEventsAPP_URL	in postInput()

#-------------------------------------------------------------------------------

# slack_postEventsAPP_URL is the POST URL for a slack app which is configured to post a message to a channel
[ -n "slack_postEventsAPP_URL" ] || echo 1>&2 required : define slack_postEventsAPP_URL e.g. https://hooks.slack.com/services/.../.../...

logDir=$HOME/log/monitor

#-------------------------------------------------------------------------------

# post param to Slack app postEventsAPP (plantinformatics)
# @param text should not contain punctuation such as \'\"\''[]<()-'
function postText() {
  pText="$1"
  curl -X POST -H 'Content-type: application/json' --data '{"text":"$pText"}' $slack_postEventsAPP_URL
}
# post stdin to Slack app postEventsAPP (plantinformatics)
# Punctuation is filtered out because currently the text is passed via command-line params.
function postInput() {
  # enable this for dev / test
  if false
  then
    (date; cat >> $logDir/test.log)
  else
    tr -d \'\"\''[]<()-' |  curl -X POST -H 'Content-type: application/json' --data '{"text":"'"$SERVER_NAME"'
'"$(cat)"'"}' $slack_postEventsAPP_URL
  fi
}

# Post stdin as a 'text snippet' via file-upload
# @param textLabel displayed as the message
function postInputAsSnippet() {
  textLabel=$1
  tr -d \'\"\''[]<()-' |  curl -X POST -H 'Content-type: application/json' --data '{"text":"$textLabel", "channels":"GC57GHSR2", "fileType":"text", "content":"'"$(cat)"'"}' $slack_postEventsAPP_URL
}

# run initially to set up $logDir, so that accessDiffPost() may be run.
function setupMonitor() {
  [ -d ~/log ] || mkdir ~/log || return
  [ -d $logDir ] || mkdir $logDir || return
  if [ ! -f $logDir/access.log ]  ; then sudo cp -ip /var/log/nginx/access.log $logDir/access.log ; fi;

  cd $logDir || return 
  [ -f server.log ] || touch server.log || return
}

# run regularly, e.g. from cron
function accessDiffPost() {
  # To handle nginx log rolling, show only the added lines of the diff, not the removed lines.
  # refn http://www.gnu.org/software/diffutils/manual/html_node/Line-Group-Formats.html
  # and https://stackoverflow.com/a/15385080
  if sudo diff --changed-group-format='%>' --unchanged-group-format='' $logDir/access.log /var/log/nginx/access.log  > $logDir/access.log.diff;
  then 
    : # same
  else
    if fgrep /api/Clients $logDir/access.log.diff | fgrep -v /api/Clients/login > $logDir/access.log.diff.api_Clients;
    then 
      postInput < $logDir/access.log.diff.api_Clients
    fi
    sudo cp -p /var/log/nginx/access.log $logDir/access.log
  fi
}

# ------------------------------------------------------------------------------

function currentLog() { echo -n ~/log/nohup_out/; ls -rt ~/log/nohup_out/ | tail -1; }

# Similar to accessDiffPost, but monitor the node server log
# run regularly, e.g. from cron
function serverDiffPost() {
  l1=$( currentLog )
  [ -z "$l1" -o  \! -f "$l1"  ] && return
  cd $logDir || return 
  logPrev=server.log
  # To handle server log rolling (when server is restarted), show only the added lines of the diff, not the removed lines.
  if sudo diff --changed-group-format='%>' --unchanged-group-format='' $logPrev "$l1"  > $logPrev.diff;
  then 
    : # same
  else
    # /api/Clients| is already logged from nginx log
    if egrep 'Error: Invalid token|ValidationError' $logPrev.diff | fgrep -v /api/Clients/login > $logPrev.diff.report;
    then 
      postInput < $logPrev.diff.report
    fi
    sudo cp -p "$l1" $logPrev
  fi
}

# ------------------------------------------------------------------------------

newSignup=newSignup
function setupMonitorSignup() {
  [ -d $logDir/$newSignup ] || mkdir $logDir/$newSignup || return
  cd $logDir || return
  monitorSignup
  ls -l *erified.tsv $newSignup
}


function monitorSignup() {
  emailVerified=true signupReport > verified.tsv
  signupReport > notVerified.tsv
}


# Compare the current and previous versions of a file.
# Used for showing additions to a log file.
# Output diff to stdout, with diffLabel appended if not empty.
#
# @return same as diff :
# diff returns : 0 (true) if files are identical, otherwise 1 (false)  
#
# @param newDir dir containing the new version. previous is in ./
# @param fileName name of pair of files to diff
# @param diffLabel text to label the diff output with, if not empty
function diffPrevious() {
  newDir="$1"
  fileName="$2"
  diffLabel="$3"
  statusDP=0
  diff {,"$newDir"/}"$fileName" || { statusDP=$?; echo "$diffLabel" ;  }
  return $statusDP
}


# @return same as diff :
# diff returns : 0 (true) if each pair of files is identical, otherwise 1 or 2 (both values are false)  
function signupDiffBoth() {
  diffPrevious "$newSignup" verified.tsv 'verified
---'
  status1=$?

  diffPrevious "$newSignup" notVerified.tsv 'notVerified'
  status2=$?

  return $(expr $status1 + $status2)
}

function signupDiffPost() {
  cd $logDir/$newSignup || return
  monitorSignup
  cd ..
  if signupDiffBoth > signup.diff
  then 
    : # same
  else
    postInput < signup.diff
    ls -l {,$newSignup/}*erified.tsv signup.diff
    cp -p $newSignup/* .
  fi
}

# Diff notVerified / unapproved since last call
# @param periodName text name for directory - e.g. "daily"
# The directory caches the previous value which is the reference for diff
#
# Usage, e.g. cron : bash -c "source ~/pretzel/resources/tools/mongo_admin.bash; source ~/pretzel/resources/tools/functions_hosted.bash; DIM=... ; slack_postEventsAPP_URL=...;  signupDiffUnapprovedPost daily 2>&1" >> $HOME/log/monitor/cron.log 2>&1
function signupDiffUnapprovedPost() {
  if [ $# -ne 1 ]
  then
    echo "Usage : $0 periodName" 1>&2;
  else
    periodName="$1"
    cd $logDir/ || return
    [ -d "$periodName" ] || mkdir "$periodName" || return
    cd "$periodName"
    [ -d $newSignup ] || mkdir $newSignup || return
    [ -f "notVerified.tsv" ] || { signupReport > notVerified.tsv; return; }

    signupReport > $newSignup/notVerified.tsv
    
    diffPrevious "$newSignup" notVerified.tsv 'notVerified'  > signupUnapproved.diff
    statusPeriod=$?

    if [ "$statusPeriod" -ne 0 ]
    then 
      postInput < signupUnapproved.diff
      ls -l {,$newSignup/}notVerified.tsv signupUnapproved.diff
      cp -p $newSignup/notVerified.tsv .
    fi
  fi
}

# ------------------------------------------------------------------------------
