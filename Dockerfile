FROM node:8.12-alpine

# required for an NPM repo
RUN apk add --no-cache git

# stage one - adding backend to image, installing modules
COPY ./backend /app

RUN cd /app && \
  npm install --only=production

# stage two - building the frontend app and adding to image
COPY ./frontend /frontend

# this large series of calls is performed in one layer
# to avoid all of the various npm frontend resources
# bloating the image size after the frontend has been built

RUN npm install bower -g \
  && cd /frontend \
  && npm install \
  && bower install --allow-root \
  && cd /app \
  && npm install


#app build call and following steps kept in a separate layer for quicker build
RUN cd /frontend \
  && node_modules/ember-cli/bin/ember build --environment production \
  && mv /frontend/dist /app/client \
  && cd / \
  && rm -rf /frontend \
  && npm uninstall -g bower \
  && npm cache clean --force

ENV EMAIL_VERIFY=NONE AUTH=ALL

ENTRYPOINT ["node", "/app/server/server.js"]

