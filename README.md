# Dav127
A Sails/Ember/D3 framework to display and interactively navigate complex datasets

<img
src="https://cloud.githubusercontent.com/assets/20571319/19416034/f1ee92b8-93d0-11e6-94a8-c18018ba40dc.png" align="center">

## Dependencies

### Database

The API server, Sails.js, supports many databases but we recommend MongoDB. Currently MySQL and
MongoDB are supported but we are in the process of moving completely to MongoDB.

Install MongoDB using your distribution's package manager; for example, in Ubuntu:
```
sudo apt-get install mongodb
```

### NPM

NPM is the package manager for Node.js and allows easy installation of the tools required by this
project. You can install NPM using your native distribution package manager; for example, in
Ubuntu:

```
sudo apt-get install npm
```

### Sails and Ember

Sails.js and Ember.js are Node.js frameworks and can be installed using npm:

```
npm install sails
npm install ember
```

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

### Set-up configs

Copy the example `connections.js` file from `server/config/`:

```
cp server/config/connections.js.example server/config/connections.js
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
cp frontend/app/adapters/application.js.example frontend/app/adapters/application.js
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
