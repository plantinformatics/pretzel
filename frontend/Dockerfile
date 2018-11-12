FROM danlynn/ember-cli:3.4.1
MAINTAINER Kieran Lomas

ARG UNAME=testuser
ARG UID=1000
ARG GID=1000
RUN echo "uid $UID gid $GID" && groupadd -g $GID $UNAME && useradd -m -u $UID -g $GID -s /bin/bash $UNAME
USER $UNAME
