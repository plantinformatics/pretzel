
# ------------------------------------------------------------------------------
#     samtools	faidx is used for DNA lookup

# samtools build layer is based on https://hub.docker.com/r/bschiffthaler/samtools/dockerfile

ARG NODE_ALPINE_VERSION 12

# ${NODE_ALPINE_VERSION}
FROM node:12-alpine as node-alpine-build-samtools

ARG NODE_ALPINE_VERSION 12
ARG SAMTOOLS_VERSION=1.15.1
ARG BUILD_NCPU=1

RUN apk update && apk add build-base wget zlib-dev tar bzip2-dev xz-dev \
    curl-dev ncurses-dev ncurses-static curl-static zlib-static bzip2-static \
    nghttp2-static openssl-libs-static brotli-static

WORKDIR /build
RUN wget https://github.com/samtools/samtools/releases/download/${SAMTOOLS_VERSION}/samtools-${SAMTOOLS_VERSION}.tar.bz2
RUN tar -xf samtools-${SAMTOOLS_VERSION}.tar.bz2
WORKDIR /build/samtools-${SAMTOOLS_VERSION}
RUN ./configure && \
    make -j${BUILD_NCPU}
RUN strip samtools


# ------------------------------------------------------------------------------

# ${NODE_ALPINE_VERSION}
FROM node:12-alpine as node-alpine-pretzel

ARG PRETZEL_VERSION 2.14.1
ARG NODE_ALPINE_VERSION 12

# node-sass version is selected so that the binary can be downloaded;
# otherwise, node-gyp will be built, and hence the following dependencies on python, make, c++.
# from : https://github.com/nodejs/docker-node/issues/610 :
#  node-sass is built using node-gyp, which is built using python.
# required for an NPM repo
# 
# alpine image uses libmusl (C stdlib) so linux_musl-x64-* is required.
# The version can be indicated either by $SASS_BINARY_NAME or --sass-binary-name :
# export SASS_BINARY_NAME=linux_musl-x64-64; npm install node-sass@^5.0.0 --sass-binary-name=linux_musl-x64-64 --scripts-prepend-node-path=true

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


# ------------------------------------------------------------------------------

ARG SAMTOOLS_VERSION=1.15.1

# RUN apk add --no-cache bash
RUN apk add --no-cache libbz2 zlib libcurl xz-libs
WORKDIR / 
COPY --from=node-alpine-build-samtools /build/samtools-${SAMTOOLS_VERSION}/samtools /usr/local/bin/samtools

# ------------------------------------------------------------------------------


# to compile node.js from source, apk add linux-headers
# for debugging binaries : add strace

ENV scriptsDir /app/lb3app/scripts

# add backend to image
COPY ./lb4app /app

# add frontend to image
COPY ./frontend /frontend
# uploadSpreadsheet.bash is in $scriptsDir/.
COPY ./resources/tools/dev/snps2Dataset.pl $scriptsDir/.

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

# $NODE_BE/bin/node
ENTRYPOINT ["/usr/local/node16/bin/node", "/app/lb3app/server/server.js"]

# ------------------------------------------------------------------------------

ARG SAMTOOLS_VERSION=1.15.1

LABEL maintainer='github.com/plantinformatics'
LABEL software.version=${PRETZEL_VERSION}
LABEL samtools.version=${SAMTOOLS_VERSION}
LABEL nodeAlpine.version=${NODE_ALPINE_VERSION}

# ------------------------------------------------------------------------------
