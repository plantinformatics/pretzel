# Docker setup

## Docker Compose Version 2 format support required

The version of docker-compose in the Ubuntu package repository does not support the 
Docker Compose Version 2 format support, required for docker-compose.yaml.
(as discussed here : https://github.com/docker/compose/issues/3331 )

### Check installed version of Docker Compose
This version was not OK :

```
$ docker-compose version 
docker-compose version 1.5.2, build unknown
docker-py version: 1.8.0
CPython version: 2.7.12+
OpenSSL version: OpenSSL 1.0.2g  1 Mar 2016
```

### Install current version from Docker package repository


The following is based on the process described in these refs:
```
https://docker.github.io/compose/install/
https://docker.github.io/engine/installation/linux/ubuntu/#uninstall-old-versions
```

Optional : check if required packages are installed; this avoids changing their installed status from auto to manual :

```
apt -qq list \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common

```
If any of those are not installed, then install with :

```
sudo apt-get install \
    apt-transport-https \
    ca-certificates \
    curl \
    software-properties-common
```

Add the Docker public key, to verify package downloads :

```
cd
ls -AF
mkdir .gpg_docker
cd !$
curl -fsSL https://download.docker.com/linux/ubuntu/gpg > docker_linux_ubuntu_pub_gpg.asc
file  !$
# Output :
docker_linux_ubuntu.gpg: PGP public key block Public-Key (old)
sudo apt-key add < !$

sudo apt-key fingerprint 0EBFCD88
# Output :
pub   rsa4096 2017-02-22 [SCEA]
      9DC8 5822 9FC7 DD38 854A  E2D8 8D81 803C 0EBF CD88
uid           [ unknown] Docker Release (CE deb) <docker@docker.com>
sub   rsa4096 2017-02-22 [S]

lsb_release -cs
# output e.g. : yakkety
```

Add the Docker package repository :

```
sudo add-apt-repository \
   "deb [arch=amd64] https://download.docker.com/linux/ubuntu \
   $(lsb_release -cs) \
   stable"
sudo apt-get update
```
You can pipe the output of apt-get update through  | fgrep -v ubuntu.com
and you should see e.g. 
```
Get:14 https://download.docker.com/linux/ubuntu yakkety/stable amd64 Packages [1,444 B]
```

```
sudo apt-get install docker-ce
# Output includes :
The following additional packages will be installed:
  aufs-tools
```

Check docker using a test container :
```
sudo docker run hello-world
```

### Install docker-compose

There doesn't seem to be a package containing docker-compose in the Docker repo;
This is the old one, in the Ubuntu repo :
```
apt-cache search docker-compose
# Output
docker-compose - Punctual, lightweight development environments using Docker

apt-cache show docker-compose
# Output
Origin: Ubuntu
Homepage: http://docs.docker.com/compose/
Version: 1.5.2-1
```

Instructions for installing docker-compose from this ref :
https://docs.docker.com/engine/installation/linux/linux-postinstall/

https://docs.docker.com/compose/

Run this command to download Docker Compose, replacing $dockerComposeVersion with the specific version of Compose you want to use:
```
curl -L https://github.com/docker/compose/releases/download/$dockerComposeVersion/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose
```

```
https://docs.docker.com/compose/install/#alternative-install-options

https://github.com/docker/compose/releases
...
1.14.0-rc2
@shin- shin- released this 12 days ago ·


cd /tmp/
dockerComposeVersion=1.14.0-rc2
curl -L https://github.com/docker/compose/releases/download/$dockerComposeVersion/docker-compose-`uname -s`-`uname -m` > docker-compose

  -rw-r--r--  1 8278064 Jun 19 14:50 docker-compose
 md5sum !$
 90c7f46....

```
```
sudo chmod a+x docker-compose
sudo chown root.root !$
ls -l !$

-rwxr-xr-x 1 root root 8278064 Jun 19 14:50 docker-compose

sudo mv -i docker-compose /usr/local/bin/.

which docker-compose
/usr/local/bin/docker-compose


sudo docker info

sudo usermod -aG docker $USER

groups

grep -w $USER /etc/group

sg docker
groups
```

It should now be possible to run a docker container without sudo :
```
 docker run hello-world
```


### Port configuration

Checking if mongodb port is in use :
```
netstat  | grep -w localhost:27017
tcp        0      0 localhost:39762         localhost:27017         ESTABLISHED
tcp        0      0 localhost:27017         localhost:39762         ESTABLISHED
```

Checking for a suitable port to use instead :
```
sysctl -a | grep  _port
...
net.ipv4.ip_local_port_range = 32768	60999
net.ipv4.ip_local_reserved_ports = 
```

Changing port of mongodb within docker container so that it does not clash with mongodb outside container :
```
backend/.env :
-PORT_DB_EXT=27017
+PORT_DB_EXT=57017

backend/docker-compose.yaml :
-      - "DB_PORT=${PORT_DB_EXT}"
+      - "DB_PORT=27017"
```


related configuration files :
```
backend/server/datasources.local.js
...
  "mongoDs": {
    "host": process.env.
DB_HOST
DB_PORT
DB_PASS
DB_USER
	
backend/server/server.js
...
var dbSources = require('./datasources.local.js')
...
var mongoString = `mongodb://${dbMongo.user}:${dbMongo.password}@${dbMongo.host}:${dbMongo.port}/${dbMongo.database}`

backend/.env 
PORT_API_EXT=5000
...
```

### Change the frontend application to refer to the backend API in the docker container
```
Dav127/frontend/app/adapters/application.js :
7c7
<     host: 'http://localhost:1776'
---
>     host: 'http://localhost:5000' // 1776
```

### Build and start the container

```
cd .../Dav127/backend
/usr/local/bin/docker-compose -f docker-compose.yaml up &
```

### Access backend API with web browser
```
http://localhost:5000/explorer/
LoopBack API Explorer

http://localhost:5000/Geneticmaps
{"geneticmaps":[]}
```

### Configure port of file upload
```
cd .../Dav127
source resources/functions.bash 
GM_API_URL=localhost:5000

e.g. :
  load_test_data_file ../resources/example_map1.json 
or :
  load_test_data
```
### Check result of file upload

http://localhost:5000/Geneticmaps

### Shutdown docker container
```
/usr/local/bin/docker-compose -f docker-compose.yaml down

```

### various

Centos packages required :
`sudo yum install docker-client.x86_64 docker-distribution.x86_64 docker-compose.noarch`

Building with nvm and sudo and specifying DB_NAME=admin :
```
MONGO_DATA_DIR=/local_mongoDb_data_for_docker
sudo DATA_DIR=$MONGO_DATA_DIR DB_NAME=admin EMAIL_VERIFY=NONE AUTH=ALL API_PORT_EXT=80 \
PATH=$( sudo sh -c 'echo $PATH'):$NVM_DIR/versions/node/$(nvm version )/bin nohup sh -c 'docker-compose -f backend/docker-compose.yaml up' > ../log/be
```

Check container contents :
`sudo docker container export  backend_api_1 | tar tvf - > /tmp/$USER/pretzel.compose.list`
Filter that output with e.g.
```
grep ' app/'
egrep -v 'node_modules/|/.npm/| -> |/.cache/bower|ca-certificates|tmp/root/if-you-need-to-delete-this-| link to |tmp/npm-'
 | less
```

Graceful shutdown of database container :
`sudo docker exec -it backend_database_1 mongo admin --eval 'db.shutdownServer()'`



## Using docker build (pretzel/Dockerfile) 

Either docker build or docker compose can be used; the pretzel project contains a top-level Dockerfile (for use with `docker build`, and used by dockerhub), and docker-compose.yaml for use with `docker compose`.
This section describes the `docker build`.


If the node-sass version is not available as a binary package, the build with depend on :
```
sudo yum install python.x86_64 python3.x86_64
npm install -g node-gyp
```

If there is already a database container running from using `docker compose` above, shut it down:
`sudo docker exec -it backend_database_1 mongo admin --eval 'db.shutdownServer()'`
and start a database container which is required by the pretzel container :
```
MONGO_DATA_DIR=/local_mongoDb_data_for_docker
sudo docker run -d -p 27017:27017 -v $MONGO_DATA_DIR:/data/db mongo
```

Build and run container
```
cd pretzel
sudo docker build -t pretzel .

DB_NAME=admin
sudo docker run --name pretz_80 --detach -e DB_NAME=$DB_NAME -e API_PORT_EXT=80  --publish 3000:3000 --net=host pretzel
```

Clean up previous builds :

```
b1=$(sudo docker image ls --all | fgrep '<none>' | awk ' {print $3; } ')
b2=$(sudo docker ps --all | fgrep 'Exited (1) 3 hours ago' | awk ' {print $1; }')
sudo docker container rm $b2
sudo docker image rm $b1
```

If package.json is changed then npm ci in build will depend on updated package-lock.json :
`npm install`

View logs
`sudo docker logs pretz_80`


Check network ports status :
```
netstat -a | fgrep 27017
sudo lsof -i tcp:http
nodePid=$(pgrep -fd, "ember|node")
ps -fp $nodePid
sudo lsof  -p  $nodePid
sudo sh -c 'ps -fp $(pgrep -fd, "ember|node")'
```

Check the http port is served :
`curl http://localhost:80 | head -5`


Inspect the port and DB_NAME configuration of a container :
```
sudo yum install jq.x86_64
sudo docker container inspect pretz_80 | jq  'map(.Config.Env)'
[
  [
    "DB_NAME=admin",
    "API_PORT_EXT=80",
    "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
    "NODE_VERSION=12.12.0",
    "YARN_VERSION=1.19.1",
    "EMAIL_VERIFY=NONE",
    "AUTH=ALL"
  ]
]
```

## Database configuration

Pretzel now uses (since branch feature/progressive) aggregation pipeline queries in mongoDb, which are available in mongoDb versions after 4.

Progressive loading of paths via aliases relies on the indices of the Alias collection, and indexes are added to the Feature collection also :

```
mongo --quiet admin
db.Feature.getIndexes()
db.Feature.createIndex({"value.0":1},{ partialFilterExpression: {"value.1": {$type: 'number'}} } )
db.Feature.createIndex({blockId:1} )

db.Alias.getIndexes()
db.Alias.createIndex ( {namespace1:1} )
db.Alias.createIndex ( {namespace2:1} )
db.Alias.createIndex ( {string1:1} )
db.Alias.createIndex ( {string2:1} )

db.Alias.createIndex ( {namespace1:1, namespace2:1} )
db.Alias.createIndex ( {string1:1, string2:1} )

exit
```
This is applicable to any of the build methods.
This assumes DB_NAME=admin;  substituted e.g. pretzel for admin.

To check if these aliases are already added :
```
db.Feature.getIndexes()
db.Alias.getIndexes()
```




## Some script functions for building and running without docker

These can be added to a .bashrc
```
export MONGO_DATA_DIR=/local_mongoDb_data_for_docker
export pretzelDir=.../pretzel
# Enable this for web inspector access to node server.
# export NODE_INSPECT=--inspect

# Use the 2nd form to override AUTH=
run_backend='npm run run:backend'
run_backend='cd backend && EMAIL_VERIFY=NONE AUTH=NONE node $NODE_INSPECT server/server.js'
DB_NAME=admin
function sudoBE() { cd $pretzelDir && sudo DB_NAME=$DB_NAME API_PORT_EXT=80 PATH=$( sudo sh -c 'echo $PATH'):$NVM_DIR/versions/node/$(nvm version )/bin sh -c $run_backend  > ../log/be ; }

#-------------------------------------------------------------------------------

function mongoStart() {
    mongod --dbpath $MONGO_DATA_DIR   --logpath $MONGO_DATA_DIR.log &
}

function mongoShutdown() {
  mongod --dbpath $MONGO_DATA_DIR  --shutdown
}


# Skip remainder of .bashrc file if this shell is not interactive (the nvm message is not handled by scp).
[[ $- != *i* ]] && return

. .bashrc.nvm
nvm use node 10.16.3
```
