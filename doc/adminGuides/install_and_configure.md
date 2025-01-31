### Audience

This guide is for system administrators tasked with installation and configuration of Pretzel, and administration of software systems and data.

This documentation will guide them through configuration of docker compose yaml files and related environment files, and provide templates of these as a starting point.

There are separate documentation resources for other audiences :
- User Documentation : https://docs.plantinformatics.io	
- Development team : pretzel/doc/notes/

---

### Background

The method of installation of Pretzel has evolved along with the application.
Our early recommendations were to use individual docker containers for the mongoDb database and Pretzel API server, but with the addition of the blastserver (Python Flask micro-service), and access to additional external databases (Blast and VCF), we have moved to docker compose to package the configuration and connection of these components.

### Docker Compose elements

In the same directory as this document there is a sample docker compose yaml file, and sample environment files.

The following section discusses configurations the system administrator may make to these files.

### Configuration of docker compose .yaml

The most important configuration is the version of the Pretzel API server :
```
  api: # node environment
    ...
    image: plantinformaticscollaboration/pretzel:v3.1.0
```

These configurations support optional features :

```
  api: # node environment
    ...
    volumes:
      # landingPage
      - $landingPage:/app/client/landingPageContent
      # blastVolume
      - $mntData/blast:$mntData/blast
      # vcfVolume
      - $mntData/vcf:$mntData/vcf
      - ${resultsCacheDir}:/app/node_modules/flat-cache/.cache
```
####	landingPage 
A directory which contains index.html and other html and image files referenced by index.html.  If provided, this content is displayed in the Pretzel home page before the user logs in.

#### blastVolume
A directory containing blastn databases.
If mntData is provided, then the default value of blastDir is $mntData/blast.

#### vcfVolume
A directory containing VCF genotype data.
If mntData is provided, then the default value of vcfDir is $mntData/vcf.

#### resultsCacheDir
The Pretzel API server will cache results for common requests, enabling them to be served more quickly and efficiently.  This directory will be created within the Pretzel API server container, or if it is configured as a shared volume, then the resultsCache will be stored in the directory passed in.  The benefit of this is that when the container is re-created, the resultsCache will be preserved.  This is not essential, but will improve performance in particular for histograms where the chromosomes (Blocks) contain 1e5 - 1e7 features.

---

### Configuration of pretzel.compose.prod.env

The template .env file has these variables commented out;  you will need to provide values for them :
- DATA_DIR
- mntData
- API_HOST
- EMAIL_*


---

Configuration for compose down & up :
```
logDate=$(date +%Y%b%d)
echo $logDate
# Location of docker compose templates
export Dc=~/pretzel/doc/adminGuides
# Use other values if you are running multiple Pretzel servers,  e.g. stage=dev
# You can simplify the naming by omitting $stage if only running a single server.
stage=prod
L=~/log/compose/$stage/$logDate
```

Docker compose down and up :
```
docker compose --progress=plain   --file $Dc/docker-compose.$stage.yaml  --env-file $Dc/pretzel.compose.$stage.env down
nohup docker compose --progress=plain   --file $Dc/docker-compose.$stage.yaml  --env-file $Dc/pretzel.compose.$stage.env  up > $L &
```

The above log file `$L` will contain the output from the 3 containers, api database and blastserver.  To record the logs into separate log files the following can be used.  This would be done before replacing them;  i.e. before compose down.
```
for i in api database blastserver; do \
docker logs pretzel-$stage-$i-1 >& ~/log/compose/$stage/$i.$logDate; done
```

Observe Pretzel server containers created by Docker compose :
```
docker ps --filter="name=pretzel-$stage-api"
```

---

### Preparing a custom Pretzel API server container image

This section describes how to build a Pretzel API server image from a particular version or branch, e.g. if a hot-fix branch has been provided.

Image build
```
# cd '<build_directory>'
git clone https://github.com/plantinformatics/pretzel.git
cd pretzel

export GIT_PAGER=cat
# replace 'master' here with the name of the branch or version to build
git checkout master

logDate=$(date +%Y%b%d)
echo $logDate
export DOCKER_BUILDKIT=1

app=pretzel
# you can use some other label name; this example uses the build date.
export PRETZEL_VERSION=v$logDate
# e.g. export PRETZEL_VERSION=v3.1.0
image=$app:$PRETZEL_VERSION

mkdir -p ~/log/build/docker
time nohup sudo docker build -t $image . > ~/log/build/docker/$logDate    &
```

Observe the image tag name; this will be used in docker compose .yaml : api : image.
```
docker image inspect $image | jq '.[] | .RepoTags'
```

Tag the built image for push to dockerhub
```
# If pushing the result to dockerhub :
# baseName='<dockerhub_organisation_name>'/$app
docker tag $image $baseName:$PRETZEL_VERSION
docker tag $image $baseName:latest
docker image inspect $image | jq '.[] | .RepoTags'
```

Push the built image to dockerhub
```
app=pretzel
baseName=plantinformaticscollaboration/$app
# $PRETZEL_VERSION as defined above
echo PRETZEL_VERSION=$PRETZEL_VERSION
for tag in $PRETZEL_VERSION latest; do docker push $baseName:$tag; done
```



---
