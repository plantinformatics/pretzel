# Use an official Python runtime as a parent image
FROM python:3.7

#-------------------------------------------------------------------------------

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

ARG mntData=/mnt/data_blast
ENV mntData=${mntData}
LABEL mntData=${mntData}

ARG blastDir=${mntData}/blast
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
