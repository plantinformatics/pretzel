#-------------------------------------------------------------------------------
# functions related to building/running of the MMV application (Pretzel).
#-------------------------------------------------------------------------------

# usage : beServer
#
# refs :
# backend/.env:2:API_PORT_EXT=5000
# backend/test/helpers/environment.js:5:process.env.API_PORT_EXT = 5000;
# doc/notes/docker_setup.md:
#   PORT_API_EXT=5000
#   GM_API_URL=localhost:5000
#   http://localhost:5000/Geneticmaps
# frontend/config/environment.js:7:    apiHost: 'http://localhost:5000',
#
# see also $pA/tools/functions_app.bash: beServer()
#
function beServer()
{
cd ~/pretzel && nohup sudo	\
 `which node`	\
 ./app/server/server.js &	\
}

#-------------------------------------------------------------------------------

# make a gzipped backup of ~/pretzel/nohup.out in ~/log/nohup_out/,
# with filename based on modification timestamp of file.
#
# Use this after stopping the backend server (e.g. sudo pkill node)
# and starting another with beServer.
#
# usage : backupPretzelNohup
#
function backupPretzelNohup() {
  cd ~/pretzel
  timeStamp=$(find nohup.out -printf '%TY%Tb%Td_%TH:%TM')
  ls -gG nohup.out
  gzip nohup.out
  ls -gG nohup.out.gz
  mv -i nohup.out.gz ~/log/nohup_out/$timeStamp.gz
}
#-------------------------------------------------------------------------------
