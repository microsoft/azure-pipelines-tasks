#!/bin/sh

# ======================================
# This script contains a collection of utility functions
# for VSTS bash tasks.
# ======================================

# make sure all variables are set
set -u

CMD_PREFIX="##vso["

# Gets input for VSTS tasks
# Converts to uppercase and replaces spaces with underscores
function getInput()
{
    local name=`echo INPUT_$1 | tr ' ' '_' | tr '[:lower:]' '[:upper:]'`
    echo ${!name} # this syntax dereferences the variable
}

# prints out variable names and their values
function printVars()
{
    for var in "$@"
    do
        echo "$var: ${!var}"
    done
}

# prints the message
function log()
{
    echo $1
}

# prints a debug message using the vso prefix
function logDebug()
{
    echo $CMD_PREFIX"task.debug]"$1
}

# prints a warning message using the vso prefix
function logWarning()
{
    echo $CMD_PREFIX"task.issue type=warning]"$1
}

# prints an error message using the vso prefix
function logError()
{
    echo $CMD_PREFIX"task.issue type=error]"$1
}
