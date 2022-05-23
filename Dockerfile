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
     py3-pip \
     make \
     g++ \
     bash	\
     perl	\
     gnumeric	\
     terminus-font	\
     curl	\
     jq	\
  && npm install bower -g

#     samtools	

# to compile node.js from source, apk add linux-headers
# for debugging binaries : add strace


# add backend to image
COPY ./lb4app /app

# add frontend to image
COPY ./frontend /frontend
COPY ./lb4app/lb3app/scripts/uploadSpreadsheet.bash /app/scripts/.
COPY ./resources/tools/dev/snps2Dataset.pl /app/scripts/.

# additional node version for lb4app (backend)
ENV NODE_BE /usr/local/node16
RUN mkdir $NODE_BE $NODE_BE/bin $NODE_BE/lib

# To copy these symbolic links successfully, copy the whole directory, not individual files :
# /usr/local/bin
#   npm -> ../lib/node_modules/npm/bin/npm-cli.js
#   npx -> ../lib/node_modules/npm/bin/npx-cli.js
COPY --from=node:16-alpine /usr/local/bin  $NODE_BE/bin
COPY --from=node:16-alpine /usr/local/lib  $NODE_BE/lib


RUN date \
  && ls -sF $NODE_BE/lib \
  && export PATH=$NODE_BE/bin:$PATH \
  && export NODE_PATH=$NODE_BE/lib/node_modules \
  && cd $NODE_BE/lib && npm -v && node -v \
  && npm config set scripts-prepend-node-path true \
  && cd /app && npm install nodemon@1.18.8 && npm ci \
  && date


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

ENTRYPOINT ["/usr/local/node16/bin/node", "/app/lb3app/server/server.js"]
