# gather base linux node image for container
FROM library/node:10-alpine

# copying from local file system context into root of container
COPY ./package.json .
COPY ./package-lock.json .


# pre-installing node_modules at root of container
# as the frequency of changes to these resources is assumed
# to be lower than project file changes, meaning these resources
# will not need to be reinstalled on every compose launch
RUN npm ci   #  use ci instead of install from npm 5.7.0 onwards
RUN node --version
RUN npm --version

# specifying node_modules as root of container rather than project folder
# if this is not specified, then node will not discover the modules
ENV NODE_PATH /node_modules