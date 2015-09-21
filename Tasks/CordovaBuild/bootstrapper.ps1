#
#  Copyright (c) Microsoft. All rights reserved.  
#  Licensed under the MIT license. See LICENSE file in the project root for full license information.
#

param (
    [string]$platform,
    [string]$configuration,
    [string]$archs,
    [string]$cordovaVersion,
    [string]$antBuild,
    [string]$keystoreFile,
    [string]$keystorePass,
    [string]$keystoreAlias,
    [string]$keyPass,
    [string]$iosSigningIdentity,
    [string]$p12,
    [string]$p12pwd,
    [string]$unlockDefaultKeychain,
    [string]$defaultKeychainPassword,
    [string]$provProfileUuid,
    [string]$provProfile,
    [string]$removeProfile,
    [string]$xcodeDeveloperDir,
    [string]$windowsAppx,
    [string]$inputArgs,
    [string]$cwd,
    [string]$outputPattern,
    [string]$targetEmulator
) 
 
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
 
# Set env vars as expected by node script
$Env:INPUT_PLATFORM = $platform
$Env:INPUT_CONFIGURATION = $configuration
$Env:INPUT_ARCHS = $archs
$Env:INPUT_CORDOVAVERSION = $cordovaVersion
$Env:INPUT_ANTBUILD = $antBuild
$Env:INPUT_KEYSTOREFILE = $keystoreFile
$Env:INPUT_KEYSTOREPASS = $keystorePass
$Env:INPUT_KEYSTOREALIAS = $keystoreAlias
$Env:INPUT_KEYPASS = $keyPass
$Env:INPUT_IOSSIGNINGIDENTITY = $iosSigningIdentity
$Env:INPUT_P12 = $p12
$Env:INPUT_P12PWD = $p12pwd
$Env:INPUT_UNLOCKDEFAULTKEYCHAIN = $unlockDefaultKeychain
$Env:INPUT_DEFAULTKEYCHAINPASSWORD = $defaultKeychainPassword
$Env:INPUT_PROVPROFILEUUID = $provProfileUuid
$Env:INPUT_PROVPROFILE = $provProfile
$Env:INPUT_REMOVEPROFILE = $removeProfile
$Env:INPUT_XCODEDEVELOPMENTDIR = $xcodeDeveloperDir
$Env:INPUT_WINDOWSAPPX = $windowsAppx
$Env:INPUT_ARGS = $inputArgs
$Env:INPUT_CWD = $cwd
$Env:INPUT_OUTPUTPATTERN = $outputPattern
$Env:INPUT_TARGETEMULATOR = $targetEmulator

# Node has an annoying habit of outputting warnings to standard error, so redirect stderr to stdout and call script
$node = Get-Command -Name node -ErrorAction Ignore
if(!$node)
{
    throw (Get-LocalizedString -Key "Unable to locate {0}" -ArgumentList 'node')
}

#cordova Script is in same spot as this powershell script
$scriptRoot = Split-Path -Parent -Path $MyInvocation.MyCommand.Definition
Invoke-Tool -Path $node.Path -Arguments "cordova.js" -WorkingFolder $scriptRoot -WarningPattern "(^npm |^Note: )"