#!/bin/sh

# ======================================
# This script calls "pod install" to download CocoaPods
#
# Inputs:
# cwd - working dir; if not specified, defaults to BUILD_SOURCEDIRECTORY
# ignoreWarnings - true redirects stderr to stdout; false doesn't redirect
#
# Environment variable input:
# BUILD_SOURCEDIRECTORY - this is one of the built-in variables; points to the repo dir
# ======================================

# include Utils
# BASH_SOURCE array contains source filename; %/* strips off the filename, leaving the path
dir="${BASH_SOURCE%/*}"
if [[ ! -d "$dir" ]]; then dir="$PWD"; fi
. "$dir/Utils.sh"

# make sure all variables are set
set -u

# change to the working directory if specified; otherwise the source directory
function changeDir()
{
    local dir=$1
    local defaultDir=$2
    
    if [ $dir ]; then
        logDebug "cd $dir"
        cd $dir
    else
        logDebug "cd $defaultDir"
        cd $defaultDir
    fi
}

# run the pod install; pipe stderr to stdout if ignoreWarnings is set
function podInstall()
{
    local ignoreWarn=$1

    if [ $ignoreWarn = true ]; then
        logDebug "pod install 2>&1"
        pod install 2>&1
    else
        logDebug "pod install"
        pod install
    fi
}

# get inputs
ignoreWarnings=$(getInput "ignoreWarnings")
cwd=$(getInput "cwd")
printVars "ignoreWarnings" "cwd" "BUILD_SOURCEDIRECTORY"

logDebug "Setting locale to UTF8 - required by CocoaPods"
export LC_ALL="en_US.UTF-8"

# execute
changeDir "$cwd" "$BUILD_SOURCEDIRECTORY"
podInstall $ignoreWarnings

