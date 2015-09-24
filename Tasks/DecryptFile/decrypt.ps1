#
#  Copyright (c) Microsoft. All rights reserved.  
#  Licensed under the MIT license. See LICENSE file in the project root for full license information.
#

param(
    [string]$cipher,
    [string]$inFile,
    [string]$passphrase,
    [string]$outFile,
    [string]$cwd
)

Write-Verbose "Entering script DecryptFile.ps1"
Write-Host "cipher = $cipher"
Write-Host "inFile = $inFile"
Write-Host "passphrase = $passphrase"
Write-Host "outFile = $outFile"
Write-Host "cwd = $cwd"

# Import the Task dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"

#Verify curl is installed correctly
$openssl = Get-Command openssl.exe
if(!$openssl) {
    throw (Get-LocalizedString -Key "Unable to find OpenSSL (openssl.exe). Verify it is installed correctly on the build agent from a mirror at: http://openssl.org/community/binaries.html" )
}

$openssl = $openssl.Path
Write-Verbose (Get-LocalizedString -Key "Found OpenSSL at {0}" -ArgumentList $openssl)

if (!$cipher)
{
   throw (Get-LocalizedString -Key "Cipher parameter not set on script")
}

if (!$inFile)
{
    throw (Get-LocalizedString -Key throw "Encrypted File parameter not set")
}

if (!$passphrase)
{
    throw (Get-LocalizedString -Key throw "Passphrase parameter not set")
}

if (!$outFile)
{
    $outFile = $inFile + ".out"
}

Write-Verbose (Get-LocalizedString -Key "Running openssl...")
Invoke-Tool -Path $openssl -WorkingFolder $cwd -Arguments  "$cipher -d -in ""$inFile"" -pass ""pass:$passphrase"" -out ""$outFile"""

Write-Verbose (Get-LocalizedString -Key "Leaving script DecryptFile.ps1")
