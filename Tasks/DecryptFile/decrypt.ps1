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
try
{
    $openssl = Get-Command openssl.exe
    $openssl = $openssl.Path
    Write-Verbose "Found OpenSSL at $openssl"
}
catch
{
    throw 'Unable to find OpenSSL (openssl.exe). Verify it is installed correctly on the build agent from a mirror at: http://openssl.org/community/binaries.html'
}

if (!$cipher)
{
    throw "Cipher parameter not set on script"
}

if (!$inFile)
{
    throw "Encrypted File paramter not set"
}

if (!$passphrase)
{
    throw "Passphrase paramter not set"
}

if (!$outFile)
{
    $outFile = $outFile + ".out"
}

Write-Verbose "Running openssl..."
Invoke-Tool -Path $openssl -WorkingFolder $cwd -Arguments  "$cipher -d -in $inFile -pass pass:$passphrase -out $outFile"

Write-Verbose "Leaving script DecryptFile.ps1"
