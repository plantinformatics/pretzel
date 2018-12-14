FROM node:8.12-alpine

# required for an NPM repo
RUN apk add --no-cache git \
  && npm install bower -g

# add backend to image
COPY ./backend /app

# add frontend to image
COPY ./frontend /frontend

RUN cd /frontend && npm install && bower install --allow-root

RUN cd /app && npm install nodemon@1.18.8 && npm install

RUN cd /frontend && node_modules/ember-cli/bin/ember build --environment production

RUN mv /frontend/dist /app/client \
  && cd / \
  && rm -rf /frontend \
  && npm uninstall -g bower \
  && npm cache clean --force

ENV EMAIL_VERIFY=NONE AUTH=ALL

ENTRYPOINT ["node", "/app/server/server.js"]

