# gather base linux node image for container
FROM library/node:6-alpine

# required for an NPM repo
RUN apk add --no-cache git

# stage one - adding backend to image, installing modules
COPY ./backend ./app

RUN cd ./app && \
    npm install

# stage two - building the frontend app and adding to image
COPY ./frontend ./frontend

# this large series of calls is performed in one layer
# to avoid all of the various npm frontend resources
# bloating the image size after the frontend has been built
RUN cd ./frontend && \
    npm install && \
    npm install bower -g && \
    bower install --allow-root && \
    npm run build && \
    mkdir -p ../app/client && \
    cp -r ./dist ../app/client && \
    cd .. && \
    rm -rf ./frontend && \
    npm uninstall -g bower && \
    npm cache clean

ENTRYPOINT ["node", "./app/server/server.js"]