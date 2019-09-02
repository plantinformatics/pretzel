source ~/.bash_custom
# which source-s other files including ~/scripts/functions_hosted.bash

# probably use a rolling log, e.g. 
export LOG_GIT=~/log/build/git
# cd $LOG_GIT; nLogs=$(ls | wc -l); nRemove=$(expr $nLogs - 8); [ $nRemove -gt 0 ] &&  rm $(ls -rt | head --lines=$nRemove)
logDateTime=$(date +'%Y%b%d_%H:%M')
# logDateTime=2018Dec10_03:00
echo logDateTime=$logDateTime

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
set -x


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

# ember build replaces dist/ so restore frontend/dist/landingPageContent
if [  \! -d  ~/pretzel/backend/client/landingPageContent 
     -a  $HOSTNAME \!= 'ip-172-31-26-153'   # don't install landingPageContent on dev.
   ]
then
    if [ -d ~/content/landingPageContent ]
    then
	ln -s ../../../content/landingPageContent ~/pretzel/backend/client/.
	ls -LdF ~/pretzel/backend/client/landingPageContent
    else
	cd
	[ -d pretzel/backend/client/landingPageContent ] || \
	    aws s3 cp  s3://shared-data-4pretzel/mongodb/landingPageContent/2018Aug22.tar.gz - | tar zxf -
	du -k pretzel/backend/client/landingPageContent
    fi
fi

cd ~/pretzel
# if backend changes also
if fgrep backend/package $LOG_GIT/$logDateTime
then
    (cd backend &&
	sudo pkill node &&
	npm install &&
	backupPretzelNohup &&
	beServer)
fi
