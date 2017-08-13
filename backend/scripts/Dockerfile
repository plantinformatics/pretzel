# gather base linux node image for container
FROM library/node:6-alpine

# copying from local file system context into root of container
COPY ./package.json .

# pre-installing node_modules at root of container
# as the frequency of changes to these resources is assumed
# to be lower than project file changes, meaning these resources
# will not need to be reinstalled on every compose launch
RUN npm install

# specifying node_modules as root of container rather than project folder
# if this is not specified, then node will not discover the modules
ENV NODE_PATH /node_modules