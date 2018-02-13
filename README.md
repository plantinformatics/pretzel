# Pretzel
A Loopback/Ember/D3 framework to display and interactively navigate complex datasets.

Developed by
- AgriBio, Department of Economic Development, Jobs, Transport and Resources (DEDJTR), Victoria,
  Australia;
- CSIRO, Canberra, Australia.

Funded by the Grains Research Development Corporation (GRDC).

<img
src="https://user-images.githubusercontent.com/20571319/36133307-12b81a22-10d1-11e8-8f51-68e52cede1f6.gif" align="center">

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

## Cloning repository and set-up

Clone the Github repository:

```
git clone https://github.com/gabrielkg/Dav127.git
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
# cd into backend directory
cd ../backend
# Install dependencies
npm install
```

Note that `npm install` in `backend/` and `frontend/` will install the Express.js and
Ember.js dependencies, including Express.js and Ember.js themselves, into those directories. For
example, `ember` is in `frontend/node_modules/ember-cli/bin/`.

### Compile Ember app

The app is served by the Loopback backend and needs to be pre-compiled:

```
cd frontend
node_modules/ember-cli/bin/ember build --environment production
```

### Set up soft links

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
Note this runs the app without any authentication or security and is only suitable for local installs or internal networks. See below for details on setting up user accounts and authentication.

### Checking things are running

If everything has worked so far, you should be able to open `http://localhost:3000` in a browser and see a landing page. If you started the backend with the above command, you can create a user by signing up, then logging in with these details (with `EMAIL_VERIFY=NONE`, the user is created immediately without any extra verification).

## Inserting data

There are five example maps in the `resources/` folder with simple dummy data. You can upload these by navigating to the Upload tab on the left panel, selecting JSON and browsing to the `resources/` folder to select a map. Once submitted, the maps should be visible in the Explorer tab.

