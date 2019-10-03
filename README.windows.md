# Dav127
A MongoDb/NodeJs/Loopback/Ember/D3 framework to display and interactively navigate complex datasets

<img
src="https://cloud.githubusercontent.com/assets/20571319/19416034/f1ee92b8-93d0-11e6-94a8-c18018ba40dc.png" align="center">

## Dependencies

### Git

Download the most recent build from Git [website](http://git-scm.com/download/win) and the download should automatically start. 
Click the downloaded exe file, and follow the install instruction.

### Database

Pretzel uses MongoDB aggregation pipeline queries to improve performance.  The API server, Node.js + Loopback.js, supports many other databases, so it would be possible to use a different database if those API optimisations were changed.

#### Install MongoDB

The MongoDB Community Server can be freely downloaded from [here](https://www.mongodb.com/download-center/community);
 select the version that is compatible with your Windows OS version, and follow the install instruction to finish the installation. 

If you do not know which version of Windows you are running, please go to your powershell or command prompt (cmd) and run following commands:
```
wmic os get caption
wmic os get osarchitecture
```

The Windows x64-bit version is currently (2019Oct) located [here](https://fastdl.mongodb.org/win32/mongodb-win32-x86_64-2012plus-4.2.0-signed.msi)

The 32-bit versions up to 3.2.22 can be downloaded from [here](https://www.mongodb.org/dl/win32/i386)

Setup MongdoDB

Create the default database folder using command prompt:
```
md C:\data\db
```

Run MongoDB via command prompt, using the path and version of the mongoDb installation :
```
C:\Program Files\MongoDB\Server\4.0\bin\mongod.exe
```



### Nodejs

Install Node.js from the official download [page](https://nodejs.org/en/download), choose the right platform and download either LTS or Current version of nodejs.
The downloaded package may also include npm as well,
or follow the [instructions](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm) for installing npm.
Loopback and Bower will be installed using npm during the build, below.
Loopback.js is based on Express.js, which was used by Pretzel until 2017Jun08 (f0d2066).

### Ember and Bower

Ember.js and Bower are Node.js packages and can be installed globally as administrator using ```npm``` via cmd (Run as administrator):

```
npm install -g ember-cli
npm install -g bower
```

It is preferable to install these globally using the npm option -g, so they may be re-used by other project builds.
Global installation requires administrator access.
Note that if you do not have administrator access, these packages will be installed locally by the ```npm
install``` command detailed below.

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

#### Install Ember dependencies

To install the various plug-ins and add-ons required by the project, use NPM and Bower (for the
Ember-specific dependencies):

```
# cd into (Loopback) server directory
cd server
# Install Loopback dependencies
npm install
# cd into Ember directory
cd ../frontend
# Install Ember dependencies
npm install
bower install
```

Note that `npm install` in `backend/` and `frontend/` will install the Ember.js dependencies, including Ember.js, into those directories. If you did not
install Ember.js globally previously, you will need to run the local binaries. For
example, `ember` is in `frontend/node_modules/ember-cli/bin/`.

### Set-up configs

Change the default configuration by editing the server and frontend configuration :
#### `backend/server/config.local.js`
e.g. you may change the defaults :
```
  "restApiRoot": "/api",
```
and
```
    "json": {
      "strict": false,
      "limit": "2000mb"
    },
    "urlencoded": {
      "extended": true,
      "limit": "2000mb"
    },
```
#### `frontend/config/environment.js`
e.g. you may change the defaults :
```
    apiHost: process.env.API_URL || 'http://localhost:5000',
    apiNamespace: 'api', // adding to the host for API calls
```

#### `frontend/app/adapters/application.js`
These inherit the configuration from the above environment.js :
```
  host: ENV.apiHost,
  namespace: ENV.apiNamespace,
```


## Running

The above `npm run go` uses a script defined in the top-level package.json.
`go` uses other scripts defined in that file, which you can run individually to start the API server and the ember (frontend framework) server separately, e.g.
* dev:backend
* build:frontend
* run:frontend

Refer to the pretel/package.json : { scripts : { }  } for details.


### Checking things are running

If the database and Node/Loopback API server have started correctly, you should see the following if you navigate to `http://localhost:5000/api/datasets?filter%5Binclude%5D=blocks` in a browser:

```
[]
```
This tells us the API is working (though currently no data has been loaded).

If Ember has started correctly, you should see something like the following in the standard out after running `ember serve`:

```
Build successful - 15937ms.

Slowest Trees                                 | Total
----------------------------------------------+---------------------
Babel                                         | 11965ms

Slowest Trees (cumulative)                    | Total (avg)
----------------------------------------------+---------------------
Babel (15)                                    | 14371ms (958 ms)
```
Navigating to `localhost:4200` in a browser, you should see a page load.

## Inserting data

Refer to the section [Inserting data](README.md) in README.md

That section refers to function uploadData() defined in pretzel/resources/tools/functions_prod.bash
This script can be run using the bash executable which is included in the native MS Windows git download (above),  or WSL.

The API will return JSON confirming the
insertion if successful.


After starting the servers as above, you can run the Pretzel web application by loading `localhost:4200` in a browser,
and after inserting data you can refresh the dataset list and select the example maps for alignment.

