#!/bin/bash

# Usage :
#   input function | goAccess function
#
# Examples
#   error_logs | goAccessHtml > nginx-error-report.html
#   api_log | goAccess		# TUI terminal display

#-------------------------------------------------------------------------------

# Initial design notes
#
# . for running in Terminal (Not *ansi-term* - it only displays the first page),
# make this optional :  -o nginx-error-report.html
# . wrapper script or functions to provide data, select output
# access / error / api, current / all, 
# . nginx config for static,  wrapper html page, with bookmarkable page URLs


#-------------------------------------------------------------------------------

export logN=/var/log/nginx
export etcN=/etc/nginx
export lfC=--log-format=COMBINED

# Docker container name of 
export DPID=$(docker ps --filter=ancestor=plantinformaticscollaboration/pretzel:v3.11.0 --format '{{ .ID }}')

#-------------------------------------------------------------------------------

function access_log()
{
  sudo cat $logN/access.log
}
function access_logs()
{
  cd $logN
  for gf_i in $(ls -rt access.log-*.gz); do sudo zcat  $i  ; done;
  sudo cat access.log-$(date +%Y%m%d);
  sudo cat access.log
}

#-------------------------------------------------------------------------------

function error_log()
{
  sudo cat $logN/error.log |\
    ~/scripts/tmp/nginx-error-to-combined.pl 
}

function error_logs()
{
  cd $logN;
  (
    sudo zcat -f $(sudo bash -c "echo error.log*.gz");
    sudo cat $(sudo bash -c "echo error.log-????????") error.log
  ) | ~/scripts/tmp/nginx-error-to-combined.pl 
}

#-------------------------------------------------------------------------------

# Pretzel server log
function api_log()
{
  docker logs $DPID |& fgrep ' /api'
}


#-------------------------------------------------------------------------------
#-------------------------------------------------------------------------------


function goAccess()
{
  goaccess $lfC
}
function goAccessHtml()
{
  goaccess - $lfC --output html
}

#-------------------------------------------------------------------------------
