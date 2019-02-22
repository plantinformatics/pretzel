#!/bin/bash

# Usage : source ~/scripts/logDateTime.bash


#===============================================================================

# Define $logDate, used to give log files a unique name.
function logDateSet()
{
    logDate=`date +%Y%b%d`; echo $logDate;
    export logDate
}


# Define $logDateTime, used to give log files a unique name.
# Derived from logDateSet().
function logDateTimeSet()
{
    logDateTime=`date +%Y%b%d_%H%M`; echo $logDateTime;
    export logDateTime
}

# history : from /home/don/tools : 8432 Apr 30  2016 functions_abc.sh
#===============================================================================
