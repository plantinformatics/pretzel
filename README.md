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
cd server
# Install Sails dependencies
npm install
cd ../frontend
# Install Ember dependencies
npm install
bower install
```

### Set-up configs

Ensure that a MongoDB entry is added in `server/config/connections.js`, reflecting your local settings:

```javascript
  mongodb: {
    adapter: 'sails-mongo',
    host: 'localhost',
    port: 27017,
    //user: '',
    //password: '',
    database: 'dav127'
  },
```
And that the `connection` setting in `server/config/models.js` is set to this entry:

```javascript
connection: 'mongodb'
```

