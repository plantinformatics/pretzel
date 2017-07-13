# Security Requirements & Architecture

This discussion note outines a framework which,
while satisfying the minimum set of requirements, 
aims to design an infrastructure which can support more general functionality.
It is likely that without extra effort
we can implement the minimum requirements in a general way which allows extension
and provides infrastructure for further applications.


## Multiple Data Sources

* local db
* local files :
A file loader dialog would enable the user to import from .json files, to the local db.
* copy/paste to/from spreadsheets etc :
The application has a thick UI, enabling flexible adaption to different problem-solving techniques, and leveraging the utility of spreadsheets.
This data is of a smaller scale, because of the limitations of spreadsheets and the clipboard.

Conversion scripts, e.g. TSV -> JSON : Dav127/resources/tools/tab2json.pl, can be used to for import / export of user's local files.

* internal servers (LAN / WAN)
* external servers (internet)

These servers may be public, or require security credentials.
For a starting point, the requirements are :
* connection URL
* account name
* account password

If a server has a mix of public and secured data, it can be represented as 2 servers, if that simplifies the implementation.

See also : Dav127/doc/notes/plan_issues/gui.md : Adding and using Data Sources


## API-s

The application implements an API connecting backend and frontend, and may also be able to access other 
API types.  Each connection URL would have an API type / version.

If an external API is sufficiently simple it may be accessed from the frontend.

More generally, the backend is probably suited to acquiring data from other APIs,
as directed by user requests from the frontend.
There may be format conversion involved (most public APIs are well supported with libraries of access functions).
It would improve response time for the backend to cache or permanently store this data (assuming licensing permits that).

* [BrAPI](https://github.com/plantbreeding/API)  ([GOBII] (http://cbsuss05.tc.cornell.edu/gobii/)

The backend is also suited to hooking into other processing tools, which may be in other languages and possibly require a separate process.

The marker aliases are currently in the chromosome JSON document, but we aim to factor that out to reduce repetition in the data and because logically the relationship is marker-alias.  This won't effect the security architecture.

## Authentication

Secure APIs involve the server providing a token in return for correct credentials,
and that token is required to authenticate subsequent requests.

Tokens should expire after a reasonable time, the API can provide auto-renewal while actively used.

## Authorisation

Authorisation can be arbitrarily complex, and tightly related to the API functions and data structure.

In the short term a simple authorisation model will be appropriate : access to a data source implies authority to read any data from that source.

The next stage requirement would be a users & groups model :
* data resolution is a JSON document, e.g. map, chromosome, or a track / layer.
* data is owned by a user & group, and has user & group permissions : read & write.
* users may be in multiple groups;  (possibly allow nested groups).
