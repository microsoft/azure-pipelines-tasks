#!/bin/sh

# ======================================
# This script generates the .ipa from the build output (.app)
#
# Inputs:
# appName - Name of the .app, e.g. FlowApp.app
# ipaName - Name of the .ipa to create, e.g. Flow.ipa
# provisioningProfile - Name of the provisioning profile (not the GUID), e.g. "Flow Dogfood Distribution"
# appPath - Relative path to the .app
# ipaPath - Relative path to the .ipa to be created
# sdk - Name of the sdk, e.g. iphoneos
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

# get inputs
appFilename=$(getInput appName)
ipaFilename=$(getInput ipaName)
provProfile=$(getInput provisioningProfile)
appPath=$(getInput appPath)
ipaPath=$(getInput ipaPath)
sdk=$(getInput sdk)
sourceDir=$BUILD_SOURCEDIRECTORY
printVars "appFilename" "ipaFilename" "provProfile" "appPath" "ipaPath" "sdk" "sourceDir"

logDebug "Creating $sourceDir/$ipaPath if it doesn't exist"
mkdir -p $sourceDir/$ipaPath # the -p creates the dir if it's not there; note that this needs to be an absolute path for the .ipa to be generated.

log "xcrun -sdk $sdk PackageApplication -v $sourceDir/$appPath/$appFilename -o $sourceDir/$ipaPath/$ipaFilename -embed '$provProfile'"
xcrun -sdk $sdk PackageApplication -v "$sourceDir/$appPath/$appFilename" -o "$sourceDir/$ipaPath/$ipaFilename" -embed '$provProfile'
