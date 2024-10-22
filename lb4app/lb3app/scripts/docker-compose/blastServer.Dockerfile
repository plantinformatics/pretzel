#-------------------------------------------------------------------------------

# Copy the blastn binary and related files from the ncbi/blast image
FROM ncbi/blast:latest as blast

# Use an official Python runtime as a parent image
FROM python:3.7

COPY --from=blast /blast /blast
# Also copy liblmdb.so* which blastn depends on.
# Lightning Memory-Mapped Database
# Refn :
#   https://github.com/LMDB/lmdb
#   http://www.lmdb.tech/
#   https://www.symas.com/lmdb
COPY --from=blast /usr/lib/x86_64-linux-gnu/liblmdb.so* /usr/lib/x86_64-linux-gnu/
COPY --from=blast /usr/bin/parallel /usr/bin/
COPY --from=blast /usr/bin/vmtouch /usr/bin/


#-------------------------------------------------------------------------------

ARG BLASTSERVER_VERSION=1.0.6
ENV BLASTSERVER_VERSION=${BLASTSERVER_VERSION}
LABEL BLASTSERVER_VERSION=${BLASTSERVER_VERSION}

ARG FLASK_PORT=4000
ENV FLASK_PORT=${FLASK_PORT}
LABEL FLASK_PORT=${FLASK_PORT}

ARG appDir=/usr/src/app
ENV appDir=${appDir}
LABEL appDir=${appDir}

# equiv in pretzel container : /app/lb3app/scripts
ARG scriptsDir=${appDir}
ENV scriptsDir=${scriptsDir}
LABEL scriptsDir=${scriptsDir}

# scripts/blastn_cont.bash : logFile=~/log/blast/blastn_cont
# ARG logFile=${appDir}/blastn_cont
# ENV logFile=${logFile}
# LABEL logFile=${logFile}

# Override with docker build --build-arg mntData=..
# or docker run -e mntData=..., or docker compose --env-file with mntData=...
ARG mntData=${mntData:-/mnt/data}
ENV mntData=${mntData}
LABEL mntData=${mntData}
# Use blastDir if defined, or default value based on mntData if defined.
ARG blastDir=${blastDir:-${mntData:-/mnt/data}/blast}
ENV blastDir=${blastDir}
LABEL blastDir=${blastDir}

RUN mkdir -p -m 755 ~/log ~/log/blast

#-------------------------------------------------------------------------------

# Set the working directory
WORKDIR /usr/src/app

# Install Flask and shell2http
RUN pip install flask flask_shell2http

# Copy the server script to the working directory
COPY ./lb4app/lb3app/scripts/blastServer.py ./app.py
COPY ./lb4app/lb3app/scripts/blastn_cont.bash ./blastn_cont.bash
COPY ./lb4app/lb3app/scripts/dnaSequenceLookup.bash ./dnaSequenceLookup.bash

# Expose the port that the Flask app runs on
EXPOSE 4000

# Define environment variables
ENV FLASK_APP=app.py

# Command to start the Flask server
# Using bash to run the server
#   --host=$dockerGatewayIP
CMD ["/usr/local/bin/flask", "run", "--host=0.0.0.0", "-p", "4000"]

#-------------------------------------------------------------------------------
