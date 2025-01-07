source ~/.bash_custom
# which source-s other files including ~/scripts/functions_hosted.bash

# probably use a rolling log, e.g. 
export LOG_GIT=~/log/build/git
# cd $LOG_GIT; nLogs=$(ls | wc -l); nRemove=$(expr $nLogs - 8); [ $nRemove -gt 0 ] &&  rm $(ls -rt | head --lines=$nRemove)
logDateTime=$(date +'%Y%b%d_%H:%M')
# logDateTime=2018Dec10_03:00
echo logDateTime=$logDateTime

# name of backend dir in pretzel/; was backend
backend=lb4app


function checkPackageLock()
{
    if git status -sb | sed -n "s/^ M //p"
    then
	if
	    git status -sb | sed -n "s/^ M //p" | fgrep -v package-lock.json
	then
	    echo changes other than package-lock.json
	    git status -sb
	    exit
	else
	    git stash save "Just package-lock changes, stashed by pullAndBuild, $logDateTime"
	fi
    fi

}

#  If it is just frontend changes :
cd ~/pretzel
git fetch && git status -sb && checkPackageLock && \
    ( git pull --ff-only |& tee $LOG_GIT/$logDateTime )  || exit
# If git log contains just 'Already up-to-date.' then could exit here,
# the remaining commands will do nothing.
statusChars=$(wc -c <$LOG_GIT/$logDateTime)
if [ $statusChars -eq 20 ]
then
    statusText=$(cat $LOG_GIT/$logDateTime)
    [ "$statusText"  = 'Already up-to-date.' ] && exit
fi

# copied from ~/.bashrc, appended by nvm install
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"  # This loads nvm

# set +x
# nvm deactivate
# set -x

if fgrep frontend/package $LOG_GIT/$logDateTime
then
    (cd frontend && npm install)
fi
if fgrep frontend/bower.json $LOG_GIT/$logDateTime
then
    (cd frontend && bower install)
fi

( grep 'files* changed' $LOG_GIT/$logDateTime  && \
    npm run build:frontend )

# set +x
# nvm use node
# set -x

# OK in command-line, not tested in cron
# refn : https://stackoverflow.com/a/24549602	itaifrenkel
function getInstanceTagName() {
  TAG_NAME="Name"
  INSTANCE_ID="`wget -qO- http://instance-data/latest/meta-data/instance-id`"
  REGION="`wget -qO- http://instance-data/latest/meta-data/placement/availability-zone | sed -e 's:\([0-9][0-9]*\)[a-z]*\$:\\1:'`"
  aws ec2 describe-tags --filters "Name=resource-id,Values=$INSTANCE_ID" "Name=key,Values=$TAG_NAME" --region $REGION --output=text | cut -f5
  # TAG_VALUE="``"
}
# awsTagName=$(getInstanceTagName)

# ember build replaces dist/ so restore frontend/dist/landingPageContent
contentDir=pretzel/backend/client/landingPageContent
if [  \! -d  ~/$contentDir	\
     -a  "$awsTagName" \!= 'dev'   ${IFS# "don't install landingPageContent on dev."}	\
   ]
then
    if [ -d ~/content/landingPageContent ]
    then
	ln -s ../../../content/landingPageContent ~/pretzel/backend/client/.
	ls -LdF ~/$contentDir
    else
	cd
	[ -d $contentDir ] || \
	    echo "$contentDir is not present" 1>&2 
	# du -k $contentDir
    fi
fi

function beServerLog() {
    cd ; logDateTime=`date +%Y%b%d_%H%M`; set -x ; API_PORT_PROXY=80 API_PORT_EXT=3010 beServer >& ~/log/nohup_out/$logDateTime ; set +x
}

cd ~/pretzel
# if backend changes also
if fgrep $backend/ $LOG_GIT/$logDateTime
then
    nvm use 16
    (cd $backend &&
	(sudo pkill -f  'node -r source-map-support' || true) &&
	(fgrep $backend/package $LOG_GIT/$logDateTime && npm install) &&
	npm run rebuild &&
	[ -f ~/pretzel/nohup.out ] && backupPretzelNohup;
	beServerLog)
fi
