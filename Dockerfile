FROM node:10-alpine

# node-sass version is selected so that the binary can be downloaded;
# otherwise, node-gyp will be built, and hence the following dependencies on python, make, c++.
# from : https://github.com/nodejs/docker-node/issues/610 :
#  node-sass is built using node-gyp, which is built using python.
# required for an NPM repo
#
# These packages are for importing spreadsheets (xlsx etc) :
# bash is now used by /backend/scripts/uploadSpreadsheet.bash
# and perl by /resources/tools/dev/snps2Dataset.pl
# gnumeric provides ssconvert, used by uploadSpreadsheet.bash
# terminus-font is required by ssconvert.
RUN apk add --no-cache git \
     --virtual .gyp \
     python \
     make \
     g++ \
     bash	\
     perl	\
     gnumeric	\
     terminus-font	\
     curl	\
     jq	\
  && npm install bower -g

# add backend to image
COPY ./backend /app

# add frontend to image
COPY ./frontend /frontend
COPY ./backend/scripts/uploadSpreadsheet.bash /app/scripts/.
COPY ./resources/tools/dev/snps2Dataset.pl /app/scripts/.


RUN node --version
RUN cd /frontend && (npm ci || npm install)  && bower install --allow-root

RUN cd /app && npm install nodemon@1.18.8 && npm ci

RUN cd /frontend && node_modules/ember-cli/bin/ember build --environment production

RUN ( [ ! -L /app/client ] || rm /app/client ) && \
  mv /frontend/dist /app/client \
  && cd / \
  && rm -rf /frontend \
  && npm uninstall -g bower \
  && npm cache clean --force

ENV EMAIL_VERIFY=NONE AUTH=ALL

ENTRYPOINT ["node", "/app/server/server.js"]