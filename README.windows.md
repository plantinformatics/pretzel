# Dav127
A Sails/Ember/D3 framework to display and interactively navigate complex datasets

<img
src="https://cloud.githubusercontent.com/assets/20571319/19416034/f1ee92b8-93d0-11e6-94a8-c18018ba40dc.png" align="center">

## Dependencies

### Git

Download the most recent build from Git website: http://git-scm.com/download/win and the download should automatically start. 
Click the downloaded exe file, and follow the install instruction.


### Database

The API server, Sails.js, supports many databases but we recommend MongoDB. Currently MySQL and
MongoDB are supported but we are in the process of moving completely to MongoDB.

Install MongoDB

Click the Download button in the top right corner of the Mongodb home page: https://www.mongodb.com, 
it will take you to the download page, and select the version that is compatible with your Windows, and follow the install instruction to finish the installation. 

If you do not know which version of Windows you are running, please go to your powershell or command prompt (cmd) and run following commands:
```
wmic os get caption
wmic os get osarchitecture
```

The 32-bit can be downloaded via: https://www.mongodb.org/dl/win32/i386

Setup MongdoDB

Create the default database folder using command prompt:
```
md C:\data\db
```

Run MongoDB via command prompt:
```
C:\Program Files\MongoDB\Server\3.4\bin\mongod.exe
```

### Nodejs

Install the nodejs via the official download page: https://nodejs.org/en/download, choose the right platform and download either LTS or Current version of nodejs.  
The downloaded package should also include npm as well.

### Sails, Ember and Bower

Sails.js, Ember.js and Bower are Node.js packages and can be installed globally as administrator using ```npm``` via cmd (Run as administrator):

```
npm install -g sails
npm install -g ember-cli
npm install -g bower
```

Note that if you do not have administrator access, these packages will be installed locally by the ```npm
install``` command detailed below.

## Cloning repository and set-up

Clone the Github repository:

```
git clone https://github.com/Seanli52/Dav127.git
```

### Install Sails and Ember dependencies

To install the various plug-ins and add-ons required by the project, use NPM and Bower (for the
Ember-specific dependencies):

```
# cd into Sails directory
cd server
# Install Sails dependencies
npm install
# cd into Ember directory
cd ../frontend
# Install Ember dependencies
npm install
bower install
```

Note that ```npm install`` in ```server/``` and ```frontend/``` will install the Sails.js and
Ember.js dependencies, including Sails.js and Ember.js, into those directories. If you did not
install Sails.js and Ember.js globally previously, you will need to run the local binaries. For
example, ```ember``` is in ```frontend/node_modules/ember-cli/bin/```.

### Set-up configs

Copy the example `connections.js` file from `server/config/`:

```
copy server/config/connections.js.example server/config/connections.js
```

And ensure that a MongoDB entry exists, reflecting your local settings:

```javascript
  mongodb: {
    adapter: 'sails-mongo',
    host: 'localhost',
    port: 27017,
    // user: '',
    // password: '',
    // database: 'your_mongo_db_name_here'
  },
```
The `connection` setting in `server/config/models.js` should be set to this entry:

```javascript
connection: 'mongodb'
```
Copy the example `application.js` file from `frontend/app/adapters/`:
```
copy frontend/app/adapters/application.js.example frontend/app/adapters/application.js
```
Ember needs to be pointed to the URL and namespace of the API in . By default, it is assumed that you
are running Sails and Ember on the same machine (`localhost`), but change this to reflect your
set-up:

```javascript
# frontend/app/adapters/application.js
import DS from 'ember-data';

export default DS.RESTAdapter.extend({
  host: 'http://localhost:1776',
  namespace: 'api/v1'
});
```
## Running

### Starting Sails and Ember

You should now be able to start Sails:

```
cd server
sails lift
```

And Ember:

```
cd frontend
ember serve
```

### Checking things are running

If Sails has started correctly, you should see the following if you navigate to `http://localhost:1776/api/v1/geneticmaps` in a browser:

```
{
  "geneticmaps": [],
  "meta": {
    "total": 0
  }
}
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

Two simple example genetic maps are in `resources/`:

```
# cat resources/example_map1.json
{ "geneticmap":
  {
    "name": "MyMap1",
    "chromosomes":
    [
      {
      "name": "MrChr",
      "markers":
        [
          {
          "name": "markerA",
          "position": 1
          },
          {
          "name": "markerB",
          "position": 1.5
          }
        ]
      }
    ]
  }
}

# cat resources/example_map2.json
{ "geneticmap":
  {
    "name": "MyMap2",
    "chromosomes":
    [
      {
      "name": "MyChr",
      "markers":
        [
          {
          "name": "markerA",
          "position": 0
          },
          {
          "name": "markerB",
          "position": 1.3
          }
        ]
      }
    ]
  }
}
```
Note that they both contain a chromosome called `MyChr` and two markers, `markerA` and `markerB`.

These maps can be uploaded using CURL:

```
curl -X POST \
     -H "Accept: application/json" -H "Content-type: application/json" \
     -d @example_map1.json \
     localhost:1776/api/v1/geneticmaps

curl -X POST \
     -H "Accept: application/json" -H "Content-type: application/json" \
     -d @example_map2.json \
     localhost:1776/api/v1/geneticmaps
```
The `-H` parameters set the headers as expected by Sails and are required. The API will return the
inserted JSON if successful.

You should now be able to load `localhost:4200` in a browser and select the two maps for alignment.

