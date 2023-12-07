[![Latest GitHub tag](https://img.shields.io/github/tag/plantinformatics/pretzel.svg?label=latest%20release&logo=github&style=for-the-badge)](https://github.com/plantinformatics/pretzel/releases)

[![Docker pulls](https://img.shields.io/docker/pulls/plantinformaticscollaboration/pretzel.svg?logo=docker&style=for-the-badge)](https://hub.docker.com/r/plantinformaticscollaboration/pretzel)
[![Docker Image Version  (latest semver)](https://img.shields.io/docker/v/plantinformaticscollaboration/pretzel.svg?logo=docker&style=for-the-badge)](https://hub.docker.com/r/plantinformaticscollaboration/pretzel)

[![Website](https://img.shields.io/website-up-down-green-red/http/plantinformatics.io.svg?label=plantinformatics.io&style=for-the-badge)](http://plantinformatics.io)


# About Pretzel <!-- omit in toc -->
A Loopback/Ember/D3 framework to display and interactively navigate complex datasets.

<img src="https://user-images.githubusercontent.com/20571319/116690793-4129a380-a9fd-11eb-85ed-6b9d91f51458.png" align="center">

Currently (2020-) funded and developed by Agriculture Victoria, Department of Jobs, Precincts and Regions (DJPR), Victoria, Australia.

Previously (2016-2020) funded by the Grains Research Development Corporation (GRDC) and co-developed by Agriculture Victoria and CSIRO, Canberra, Australia.

# Table of Contents <!-- omit in toc -->
- [Features](#features)
- [Quick start (using docker)](#quick-start-using-docker)
  - [Docker on linux](#docker-on-linux)
  - [Docker on windows](#docker-on-windows)
  - [Checking things are running](#checking-things-are-running)
  - [Loading data](#loading-data)
    - [Using pretzel web interface](#using-pretzel-web-interface)
    - [Using command line](#using-command-line)
- [Setting up your own instance (without docker)](#setting-up-your-own-instance-without-docker)
  - [Note for installation on MS Windows](#note-for-installation-on-ms-windows)
  - [Dependencies](#dependencies)
    - [Database](#database)
    - [Node.js, NPM and Bower](#nodejs-npm-and-bower)
    - [Mac iOS install of Node and Mongodb](#mac-ios-install-of-node-and-mongodb)
  - [Cloning repository and set-up](#cloning-repository-and-set-up)
    - [Default build](#default-build)
    - [Step-by-step build procedure](#step-by-step-build-procedure)
  - [Running](#running)
    - [Starting the app](#starting-the-app)
    - [Checking things are running](#checking-things-are-running-1)
    - [Starting for development](#starting-for-development)
    - [Adding user verification](#adding-user-verification)
  - [Inserting data](#inserting-data)
    - [Loading data via the command line](#loading-data-via-the-command-line)
- [Public genetic map references](#public-genetic-map-references)


# Features

## Axis re-ordering <!-- omit in toc -->

<img src="https://user-images.githubusercontent.com/20571319/36240208-2781bdde-1264-11e8-9b25-4393021935e3.gif" align="center">

## Axis flipping <!-- omit in toc -->

<img src="https://user-images.githubusercontent.com/20571319/36240360-3b5db6fe-1265-11e8-9675-97b8bc9c8f07.gif" align="center">

## Zoom <!-- omit in toc -->

<img src="https://user-images.githubusercontent.com/20571319/36240487-2a2b5840-1266-11e8-9d71-fe4d275c4adb.gif" align="center">

## Axis stacking <!-- omit in toc -->

<img src="https://user-images.githubusercontent.com/20571319/36240958-80b982b2-1267-11e8-95b0-f59b999ead29.gif" align="center">

NOTE: References for the genetic maps shown in the alignments on this page are available at the bottom of this page.

## Genotype table : Merge Rows, additional data columns <!-- omit in toc -->

<img alt="Screenshot from 2023-03-20 12-09-22" src="https://user-images.githubusercontent.com/2305340/226578361-3534d5d4-bd83-49b4-b941-786f0ac7f9d1.png" align="center">


## Genotype table : small cells <!-- omit in toc -->

<img alt="Screenshot from 2023-03-10 23-10-33" src="https://user-images.githubusercontent.com/2305340/226578603-fc1cae29-c777-424c-b343-61134a37a3b9.png" align="center">


## Compound Axis.  Presentation controls. <!-- omit in toc -->

<img alt="Screenshot from 2023-02-02 14-19-59" src="https://user-images.githubusercontent.com/2305340/226580188-aceff45a-036d-43f3-b362-543e3b14cfd8.png" align="center">

## Genotype table : nucleotide view <!-- omit in toc -->

<img alt="Screenshot from 2022-10-10 16-07-49" src="https://user-images.githubusercontent.com/2305340/226576427-58767b40-add3-43e8-9b46-39f04fd287fc.png" align="center">

## Feature Search <!-- omit in toc -->

<img alt="Screenshot from 2022-09-27 17-25-51" src="https://user-images.githubusercontent.com/2305340/226577416-869c28f1-21f9-4259-8eac-f97ab31348fd.png" align="center">

## Synteny Block display <!-- omit in toc -->

<img alt="Pretzel-LogoIdea-03" src="https://user-images.githubusercontent.com/2305340/226578048-0abdaf6d-6967-44d3-9a30-ed19b1b7b595.PNG" align="center">



# Quick start (using docker)

For a quick start without installing any of the dependencies you will need docker engine running on your system.

## Environment variables passed to Docker 

As noted below in [Enable Use Of HandsOnTable](#enable-use-of-handsontable),
the License Key for HandsOnTable can be passed in to the server via this environment variable : $handsOnTableLicenseKey

This can be passed via the docker run command via -e, e.g.
for a non-commercial project, e.g. research, it is permitted to define :
`docker run --name pretzel -e "handsOnTableLicenseKey=non-commercial-and-evaluation" ...`

## Docker on linux

```
mkdir -p ~/mongodata \
 && docker run --name mongo --detach --volume ~/mongodata:/data/db --net=host mongo:5.0 \
 && until $(curl --silent --output /dev/null localhost:27017 || \
    [ $(docker inspect -f '{{.State.Running}}' mongo) = "false" ]); do printf '.'; sleep 1; done \
 && docker run --name pretzel --detach --net=host plantinformaticscollaboration/pretzel:stable  \
 && until $(curl --silent --output /dev/null localhost:3000 || \
    [ $(docker inspect -f '{{.State.Running}}' pretzel) = "false" ] ); do printf '.'; sleep 1; done \
 && docker logs pretzel
```

mongoDb versions 4 and 5 have been tested with Pretzel.

## Docker on windows

```
md mongodata
docker run --name mongo --detach --publish 27017:27017 --volume mongodata:/data/db mongo
docker run --name pretzel -e "DB_HOST=host.docker.internal" --publish 3000:3000 plantinformaticscollaboration/pretzel:stable
```

## Checking things are running

If everything has worked so far, you should be able to open [http://localhost:3000](http://localhost:3000) in a browser and see a landing page.
You can create a user by signing up, then logging in with these details (by default, the user is created immediately without any extra verification).

## Loading data

Once your pretzel instance is running you may want to populate it with some data.


### Using pretzel web interface

You can start by downloading and decompressing datasets (3 genetic maps) we have made available [here](https://github.com/plantinformatics/pretzel/releases/download/v1.1.5/public_maps.zip).
In your instance of Pretzel, navigate to the Upload tab on the left panel, select JSON and browse to the location where you extracted the content of the downloaded file. Select and submit each of the three JSON files in turn. Once submitted, the maps should be visible in the Explorer tab.

### Using command line

To upload multiple genomes along with feature definitions and aliases defining syntenic relationships between the features, you can

1. Download the [pre-computed data](https://github.com/plantinformatics/pretzel-input-generator/releases/tag/v1.0),
  ```
  wget https://github.com/plantinformatics/pretzel-input-generator/releases/download/v1.0/pretzel-genomes-features-aliases-JSON.tar.gz
  ```
2. Unpack
  ```
  tar xzvf pretzel-genomes-features-aliases-JSON.tar.gz
  ```
3. Follow the [upload instructions](https://github.com/plantinformatics/pretzel-input-generator/blob/v1.0/doc/upload.md)

# Setting up your own instance (without docker)

## Note for installation on MS Windows

The easiest way to set up a local instance on Windows is to first install the Windows Subsystem for Linux, as documented
* [here for version 1](https://docs.microsoft.com/en-us/windows/wsl/install-win10) or
* [here for version 2](https://docs.microsoft.com/en-us/windows/wsl/wsl2-install).

Once the WSL is installed and you are within a Linux subsystem -powered command-line shell,
all steps below may be followed as specified.

## Dependencies

### Database

Install MongoDB using your distribution's package manager; for example, in Ubuntu:
```
sudo apt-get install mongodb
```

### Node.js, NPM and Bower

NPM is the package manager for Node.js and allows easy installation of the tools required by this
project. You can install Node.js and NPM using your native distribution package manager; for example, in
Ubuntu:

```
sudo apt-get install nodejs npm
```

Bower is a front-end package manager and depends on Node.js and NPM. Install it globally:

```
sudo npm install bower -g
```

### Mac iOS install of Node and Mongodb

Prerequisites :
XCode :  https://itunes.apple.com/us/app/xcode/id497799835
Homebrew : https://brew.sh

```
brew install node
brew install mongodb
npm install bower -g
```

The default location of the mongo database is /data/db;  to place the data in e.g. your home directory :
```
cd ~/Applications/
mkdir Pretzel
export MONGO_DATA_DB=$HOME/Applications/Pretzel/data_db
mkdir $MONGO_DATA_DB
mongod --dbpath $MONGO_DATA_DB
```


## Cloning repository and set-up

Clone the Github repository:

```
git clone https://github.com/plantinformatics/pretzel.git
```

### Default build

To setup and build the frontend and backend, and run the backend :

```
cd pretzel
npm run go
```

### Step-by-step build procedure

This sections describes steps of default build individually, as an alternative to `npm run go`.

#### Install Ember dependencies <!-- omit in toc -->

To install the various plug-ins and add-ons required by the project, use NPM and Bower (for the
Ember-specific dependencies):

```
# cd into Ember directory
cd pretzel/frontend
# Install Ember dependencies
npm install
bower install
# cd into backend directory
cd ../lb4app
# Install dependencies
npm install
```

As part of the process of updating the backend server from Loopback version 3 to 4, backend/ has been renamed to lb4app/lb3app/.
(the current plan is to rename lb4app/ to backend/).

Note that `npm install` in `lb4app/` and `frontend/` will install the Express.js and
Ember.js dependencies, including Express.js and Ember.js themselves, into those directories. For
example, `ember` is in `frontend/node_modules/ember-cli/bin/`.

#### Compile Ember app <!-- omit in toc -->

The app is served by the Loopback backend and needs to be pre-compiled:

```
cd ../frontend
node_modules/ember-cli/bin/ember build --environment production
cd ..
```

#### Set up soft links <!-- omit in toc -->

The Loopback backend expects the compiled client in its client/ sub-directory. You can simply create a soft link:

```
ln -s ../frontend/dist lb4app/client
```

## Running

### Enable use of HandsOnTable

HandsOnTable is a commercial library which is used in the Pretzel Feature Table and Genotype Table, and may optionally be used in the Paths Table.
The License Key for HandsOnTable can be passed in to the server via this environment variable : $handsOnTableLicenseKey

For a non-commercial project, e.g. research, it is permitted to define :
`export handsOnTableLicenseKey=non-commercial-and-evaluation ;`

Define and export handsOnTableLicenseKey before `node lb3app/server/server.js` in the following.

### Starting the app

You should now be able to start the Loopback backend:

```
cd lb4app
EMAIL_VERIFY=NONE AUTH=ALL node lb3app/server/server.js
```
Note that this runs the app without any authentication or security and is only suitable for local installs or internal networks. See below for details on setting up user accounts and authentication.

### Checking things are running

If everything has worked so far, you should be able to open [http://localhost:3000](http://localhost:3000) in a browser and see a landing page. If you started the backend with the above command, you can create a user by signing up, then logging in with these details (with `EMAIL_VERIFY=NONE`, the user is created immediately without any extra verification).

### Starting for development

To start the app for code development with live reloads on changes  
1. Ensure the Ember-CLI tool is installed  globally  
```
npm install -g ember-cli
```  
2. Run the backend independently, with an assigned port  
```
EMAIL_VERIFY=NONE AUTH=ALL API_PORT_EXT=5000 npm run run:backend
```  
3. Run the frontend independently, using Ember CLI  
```
cd frontend && ember serve
```  

### Adding user verification

To use with [Postfix](http://www.postfix.org/) on Ubuntu 18.04, run `apt install mailutils` and follow the wizard defaults (for 'Internet Site').

Test postfix by sending yourself an email, e.g. `echo "Test message" | mail your.email@address.com` - the message may and up in your SPAM folder.

If it works, specify required environmental variables and run the app as per the dummy example below.

```
API_HOST=your_IP_or_FQDN EMAIL_VERIFY=ADMIN EMAIL_FROM=noreply@pretzel EMAIL_ADMIN=your@admin EMAIL_HOST=localhost EMAIL_PORT=25 AUTH=ALL node server/server.js
```

Make sure you modify:

* `API_HOST` - should be set either to host IP number or its fully qualified domain name (FQDN)
* `EMAIL_ADMIN` - email address of the person who will authorise the registration of new users

Alternatively, if you have access to your organisation's or hosting provider's SMTP server,
then rather than using Postfix, update `EMAIL_HOST` and `EMAIL_PORT` to appropriate values.
You may also have to supply your credential by specifying `EMAIL_USER` and `EMAIL_PASS`.



## Inserting data

There are example datasets in the [pretzel-data](https://github.com/plantinformatics/pretzel-data) repository with simple dummy data. You can get the data with
```
git clone https://github.com/plantinformatics/pretzel-data
```
and upload these files by navigating to the Upload tab on the left panel, selecting JSON and browsing to pretzel-data/ to select a map. Once submitted, the maps should be visible in the Explorer tab.
The file myDataset.json defines the reference myGenome, and hence should be uploaded before the files which refer to that reference : myAnnotation.json myMarkers.json  myMarkers2.json mySample.json aliases.json 


### Loading data via the command line

An alternative to the Upload tab is to use the command-line, e.g. for larger files :
```
export APIHOST=http://localhost:3000
source ~/Applications/Pretzel/pretzel/resources/tools/functions_prod.bash
```

Logging in to the web application authorises a token, which is required by the API.

While logged into Pretzel via the browser, use the Web Inspector to get the authentication token :
```
From Ctrl-click : Inspect ...
>> Application : Storage : Cookies : http://localhost:3000 :  Name : ember_simple_auth-session
```
Copy/Paste the Value into a url decoder such as e.g. https://urldecode.org which will display the decoded parameters as e.g. :
```
{"authenticated":{"authenticator":"authenticator:pretzel-local","token":"0uOnWyy08OGcDJbC9eRx5Ki73z2OYkqvrZqQTJmoAklmysU5CxtrYmrXUpcX8MOe","clientId":"5ba9c0870612bf19a6afed01"}}
```
Copy/paste the token value and set it in the command-line environment using :
```
setToken  "authentication-token-goes-here"
```
Then in the same shell you can use the API to upload dataset files :
```
uploadData ~/Applications/Pretzel/pretzel-data/myMap.json
uploadDataList myDataset.json myAnnotation.json myMarkers.json myMarkers2.json mySample.json
URL=$URL_A uploadData aliases.json 
```

## Database Indexes

Refer to 'Database configuration' in doc/notes/database-configuration.md for indexes added to the Feature and Alias database collections which are required for reasonable performance as datasets grown beyond 1k documents.


# Public genetic map references

Wang, S., Wong, D., Forrest, K., Allen, A., Chao, S., Huang, B. E., Maccaferri, M., Salvi, S., Milner, S. G., Cattivelli, L., Mastrangelo, A. M., Whan, A., Stephen, S., Barker, G., Wieseke, R., Plieske, J., International Wheat Genome Sequencing Consortium, Lillemo, M., Mather, D., Appels, R., Dolferus, R., Brown-Guedira, G., Korol, A., Akhunova, A. R., Feuillet, C., Salse, J., Morgante, M., Pozniak, C., Luo, M.-C., Dvorak, J., Morell, M., Dubcovsky, J., Ganal, M., Tuberosa, R., Lawley, C., Mikoulitch, I., Cavanagh, C., Edwards, K. J., Hayden, M. and Akhunov, E. (2014), *Characterization of polyploid wheat genomic diversity using a high-density 90 000 single nucleotide polymorphism array.* Plant Biotechnol J, 12: 787–796. doi:10.1111/pbi.12183

Gardner, K. A., Wittern, L. M. and Mackay, I. J. (2016), *A highly recombined, high-density, eight-founder wheat MAGIC map reveals extensive segregation distortion and genomic locations of introgression segments.* Plant Biotechnol J, 14: 1406–1417. doi:10.1111/pbi.12504

Wen, W., He, Z., Gao, F., Liu, J., Jin, H., Zhai, S., Xia, X. (2017). *A High-Density Consensus Map of Common Wheat Integrating Four Mapping Populations Scanned by the 90K SNP Array.* Frontiers in Plant Science, 8, 1389. http://doi.org/10.3389/fpls.2017.01389

# Software / Tools Acknowledgments

### Images / Media

[bucketFill.png](https://www.flaticon.com/free-icon/bucket_834205?term=paint%20bucket&page=1&position=53&page=1&position=53&related_id=834205&origin=tag)
from : Icons made by [Freepik](https://www.freepik.com) from [www.flaticon.com](https://www.flaticon.com/)
