#-------------------------------------------------------------------------------
# functions related to monitoring user signup and confirmation.
#-------------------------------------------------------------------------------

# usage : 
#  source ~/scripts/functions_monitor.bash
#  initialise : 
#   setupMonitor
#  regular / cron :
#   accessDiffPost

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
    tr -d \'\"\''[]<()-' |  curl -X POST -H 'Content-type: application/json' --data '{"text":"'"$(cat)"'"}' $slack_postEventsAPP_URL
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
}

# run regularly, e.g. from cron
function accessDiffPost() {
  if sudo diff  /var/log/nginx/access.log $logDir/access.log > $logDir/access.log.diff;
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

# @return same as diff :
# diff returns : 0 (true) if files are identical, otherwise 1 (false)  
function signupDiffBoth() {
  if diff {,$newSignup/}verified.tsv
  then
    status1=$?
  else
    status1=$?; echo verified; echo ---; echo
  fi

  if diff {,$newSignup/}notVerified.tsv
  then
    status2=$?
  else
    status2=$?; echo notVerified
  fi

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



# ------------------------------------------------------------------------------
