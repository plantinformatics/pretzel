# Dav127
An Express/Ember/D3 framework to display and interactively navigate complex datasets.

Developed by
- AgriBio, Department of Economic Development, Jobs, Transport and Resources (DEDJTR), Victoria,
  Australia;
- CSIRO, Canberra, Australia.

Funded by the Grains Research Development Corporation (GRDC).

<img
src="https://cloud.githubusercontent.com/assets/20571319/19416034/f1ee92b8-93d0-11e6-94a8-c18018ba40dc.png" align="center">

## Dependencies

### Database

Install MongoDB using your distribution's package manager; for example, in Ubuntu:
```
sudo apt-get install mongodb
```

### Node.js and NPM

NPM is the package manager for Node.js and allows easy installation of the tools required by this
project. You can install Node.js and NPM using your native distribution package manager; for example, in
Ubuntu:

```
sudo apt-get install nodejs npm
```

## Cloning repository and set-up

Clone the Github repository:

```
git clone https://github.com/Seanli52/Dav127.git
```

### Install Ember dependencies

To install the various plug-ins and add-ons required by the project, use NPM and Bower (for the
Ember-specific dependencies):

```
# cd into Ember directory
cd frontend
# Install Ember dependencies
npm install
bower install
# cd into Express app directory
cd ../backend
# Install dependencies
npm install
```

Note that `npm install` in `backend/` and `frontend/` will install the Express.js and
Ember.js dependencies, including Express.js and Ember.js themselves, into those directories. For
example, `ember` is in `frontend/node_modules/ember-cli/bin/`.

### Set-up configs

Ember needs to be pointed to URL of the API in `frontend/app/adapters/application.js`. Copy default settings from `frontend/app/adapters/application.js.example`:

```
cp frontend/app/adapters/application.js.example frontend/app/adapters/application.js
```
By default, it is assumed that you are running Express and Ember on the same machine (`localhost`), but change this to reflect your set-up:

```javascript
# frontend/app/adapters/application.js

import DS from 'ember-data';
import PartialModelAdapter from 'ember-data-partial-model/mixins/adapter';

export default DS.RESTAdapter.extend(PartialModelAdapter, {
  host: 'http://localhost:1776',
});
```
## Running

### Starting Express and Ember

You should now be able to start the Express API server:

```
cd backend
node app.js
```

And Ember:

```
cd frontend
ember serve
```

### Checking things are running

If the Express API has started correctly, you should see the following if you navigate to `http://localhost:1776/geneticmaps` in a browser:

```
{
  "geneticmaps": [],
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

These maps can be uploaded using `curl`:

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

You should now be able to load `localhost:4200` in a browser and select the two maps for alignment.
