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
    throw (Get-LocalizedString -Key "Unable to find OpenSSL (openssl.exe). Verify it is installed correctly and in the path on the build agent server. Binaries can be found at: http://go.microsoft.com/fwlink/?LinkID=627128" )
}

$openssl = $openssl.Path
Write-Verbose  "Found OpenSSL at $openssl"

if (!$cipher)
{
   throw (Get-LocalizedString -Key "Cipher parameter not set on script")
}

if (!$inFile)
{
    throw (Get-LocalizedString -Key "Encrypted File parameter not set")
}

if (!$passphrase)
{
    throw (Get-LocalizedString -Key "Passphrase parameter not set")
}

if ($outFile -eq $cwd)
{
    $outFile = $inFile + ".out"
}

Write-Verbose "Running openssl..."
Invoke-Tool -Path $openssl -WorkingFolder $cwd -Arguments  "$cipher -d -in ""$inFile"" -pass ""pass:$passphrase"" -out ""$outFile"""

Write-Verbose "Leaving script DecryptFile.ps1"
