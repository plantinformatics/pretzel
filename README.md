[![Latest GitHub tag](https://img.shields.io/github/tag/plantinformatics/pretzel.svg?label=latest%20release&logo=github&style=for-the-badge)](https://github.com/plantinformatics/pretzel/releases)


[![Docker pulls](https://img.shields.io/docker/pulls/plantinformaticscollaboration/pretzel.svg?logo=docker&style=for-the-badge)](https://hub.docker.com/r/plantinformaticscollaboration/pretzel)
[![Docker pulls](https://img.shields.io/docker/automated/plantinformaticscollaboration/pretzel.svg?logo=docker&style=for-the-badge)](https://hub.docker.com/r/plantinformaticscollaboration/pretzel)
[![Docker pulls](https://img.shields.io/docker/build/plantinformaticscollaboration/pretzel.svg?logo=docker&style=for-the-badge)](https://hub.docker.com/r/plantinformaticscollaboration/pretzel)

[![Website](https://img.shields.io/website-up-down-green-red/http/plantinformatics.io.svg?label=plantinformatics.io&style=for-the-badge)](http://plantinformatics.io)

# About Pretzel <!-- omit in toc -->
A Loopback/Ember/D3 framework to display and interactively navigate complex datasets.

Developed by
- AgriBio, Department of Economic Development, Jobs, Transport and Resources (DEDJTR), Victoria,
  Australia;
- CSIRO, Canberra, Australia.

Funded by the Grains Research Development Corporation (GRDC).

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


# Quick start (using docker)

For a quick start without installing any of the dependencies you will need docker engine running on your system.

## Docker on linux

```
mkdir -p ~/mongodata \
 && docker run --name mongo --detach --volume ~/mongodata:/data/db --net=host mongo \
 && until $(curl --silent --fail --output /dev/null localhost:27017); do printf '.'; sleep 1; done \
 && docker run --name pretzel --detach --net=host plantinformaticscollaboration/pretzel:stable  \
 && until $(curl --silent --fail --output /dev/null localhost:3000); do printf '.'; sleep 1; done \
 && docker logs pretzel
```

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
cd ../backend
# Install dependencies
npm install
```

Note that `npm install` in `backend/` and `frontend/` will install the Express.js and
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
ln -s ../frontend/dist backend/client
```

## Running

### Starting the app

You should now be able to start the Loopback backend:

```
cd backend
EMAIL_VERIFY=NONE AUTH=ALL node server/server.js
```
Note that this runs the app without any authentication or security and is only suitable for local installs or internal networks. See below for details on setting up user accounts and authentication.

### Checking things are running

If everything has worked so far, you should be able to open [http://localhost:3000](http://localhost:3000) in a browser and see a landing page. If you started the backend with the above command, you can create a user by signing up, then logging in with these details (with `EMAIL_VERIFY=NONE`, the user is created immediately without any extra verification).

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

There are five example maps in the `resources/` folder with simple dummy data. You can upload these by navigating to the Upload tab on the left panel, selecting JSON and browsing to the `resources/` folder to select a map. Once submitted, the maps should be visible in the Explorer tab.

### Loading data via the command line

An alternative to the Upload tab is to use the command-line, e.g. for larger files :

export APIHOST=http://localhost:3000
source ~/Applications/Pretzel/pretzel/resources/tools/functions_prod.bash

While logged into Pretzel via the browser, use the Web Inspector to get the authentication token :
From Ctrl-click : Inspect ...
>> Application : Storage : Cookies : http://localhost:3000 :  Name : ember_simple_auth-session
Copy/Paste the Value into a url decoder such as e.g. https://urldecode.org which will display the decoded parameters as e.g. :
{"authenticated":{"authenticator":"authenticator:pretzel-local","token":"0uOnWyy08OGcDJbC9eRx5Ki73z2OYkqvrZqQTJmoAklmysU5CxtrYmrXUpcX8MOe","clientId":"5ba9c0870612bf19a6afed01"}}
Copy/paste the token value and set it in the command-line environment using :
```
setToken  "authentication-token-goes-here"
uploadData ~/Applications/Pretzel/pretzel-data/myMap.json
```


# Public genetic map references

Wang, S., Wong, D., Forrest, K., Allen, A., Chao, S., Huang, B. E., Maccaferri, M., Salvi, S., Milner, S. G., Cattivelli, L., Mastrangelo, A. M., Whan, A., Stephen, S., Barker, G., Wieseke, R., Plieske, J., International Wheat Genome Sequencing Consortium, Lillemo, M., Mather, D., Appels, R., Dolferus, R., Brown-Guedira, G., Korol, A., Akhunova, A. R., Feuillet, C., Salse, J., Morgante, M., Pozniak, C., Luo, M.-C., Dvorak, J., Morell, M., Dubcovsky, J., Ganal, M., Tuberosa, R., Lawley, C., Mikoulitch, I., Cavanagh, C., Edwards, K. J., Hayden, M. and Akhunov, E. (2014), *Characterization of polyploid wheat genomic diversity using a high-density 90 000 single nucleotide polymorphism array.* Plant Biotechnol J, 12: 787–796. doi:10.1111/pbi.12183

Gardner, K. A., Wittern, L. M. and Mackay, I. J. (2016), *A highly recombined, high-density, eight-founder wheat MAGIC map reveals extensive segregation distortion and genomic locations of introgression segments.* Plant Biotechnol J, 14: 1406–1417. doi:10.1111/pbi.12504

Wen, W., He, Z., Gao, F., Liu, J., Jin, H., Zhai, S., Xia, X. (2017). *A High-Density Consensus Map of Common Wheat Integrating Four Mapping Populations Scanned by the 90K SNP Array.* Frontiers in Plant Science, 8, 1389. http://doi.org/10.3389/fpls.2017.01389
