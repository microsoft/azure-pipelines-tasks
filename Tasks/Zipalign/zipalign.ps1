param(
    [string]$apk,
    [string]$alignment,
    [string]$arguments,
    [string]$zipalignLocation
)

function RenameExtension($path, $newExtension)
{
    if (!(Test-Path -Path $path -PathType Leaf)) 
    {
        throw "Cannot rename directories or non-existent file $path."	
    }	

    $file = Get-ChildItem $path

    $newName = $file.Name + $newExtension
    $newFullPath = $file.DirectoryName + "\" + $newName
    if (Test-Path -Path $newFullPath -PathType Leaf) 
    {
        Remove-Item -Path $newFullPath
    }
    Rename-Item -Path $file -NewName $newName 

    return $newFullPath
}

Write-Verbose "Entering script zipalign.ps1"
Write-Verbose "apk = $apk"
Write-Verbose "alignment = $alignment"
Write-Verbose "arguments = $arguments"
Write-Verbose "zipalignLocation = $zipalignLocation"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if (!$apk)
{
    throw "APK parameter not set on script"
}

# check for project pattern
if ($apk.Contains("*") -or $apk.Contains("?"))
{
    Write-Verbose "Pattern found in solution parameter. Calling Find-Files."
    Write-Verbose "Find-Files -SearchPattern $apk"
    $apkFiles = Find-Files -SearchPattern $apk
    Write-Verbose "apkFiles = $apkFiles"
}
else
{
    Write-Verbose "No Pattern found in project parameter."
    $apkFiles = ,$apk
}

if (!$apkFiles)
{
    throw "No project with search pattern '$apk' was found."
}

# verify parameters required for zipaligning apk 
if (!$zipalignLocation) 
{
    $zipalignPattern = $env:ANDROID_HOME + "\build-tools\**\zipalign.exe"
    $zipalignExecutables = Find-Files -SearchPattern $zipalignPattern
    if ($zipalignExecutables) 
    {
        foreach ($executable in $zipalignExecutables) 
        {
            $zipaligner = $executable
            break;
        }
    }
}
else {
    $zipaligner = $zipalignLocation
}

if (!(Test-Path -Path $zipaligner -PathType Leaf)) 
{
    throw "Can not locate zipalign.exe, please verify ANDROID_HOME is properly configured on the build machine."	
}	

if (!$alignment) 
{
    throw "Must specify alignment"
}

foreach ($apkFile in $apkFiles) 
{
        # move the apk file so we do not pollute the work direcotry with multiple apks
        $unalignedApk = RenameExtension $apkFile ".unaligned"

        $zipalignArgs = "$arguments $alignment $unalignedApk $apkFile" 

        Invoke-Tool -Path $zipaligner -Arguments $zipalignArgs
}

Write-Verbose "Leaving script zipalign.ps1"
