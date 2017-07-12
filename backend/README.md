# Dav127 Backend API Service

## Overview
This project facilitates local authorisation and data upload and retrieval services for the frontend Dav127 software. The bulk of the project structure is supported by Loopback, which is a superset of express and provides automation for common API requests, and allows for extensions to allow project-specific scenarios.

The project structure is as follows:
* common
  * models for data structures including the client (user) data, and stored genetic map data which is still in active development
  * bespoke utility methods which are used repeatedly in the application
* server
  * boot scripts to facilitate final project configuration and resource assignment
  * Loopback-specific settings for configuration, datasources, middleware, and models
