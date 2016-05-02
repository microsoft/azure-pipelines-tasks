param(
    [string]$files,
    [string]$jarsign,
    [string]$keystoreFile,
    [string]$keystorePass,
    [string]$keystoreAlias,
    [string]$keyPass,
    [string]$jarsignerArguments,
    [string]$zipalign,
    [string]$zipalignLocation
)

Write-Verbose "Entering script AndroidSigning.ps1"
Write-Verbose "files = $files"
Write-Verbose "jarsign = $jarsign"
Write-Verbose "keystoreFile = $keystoreFile"
Write-Verbose "keystoreAlias = $keystoreAlias"
Write-Verbose "jarsignerArguments = $jarsignerArguments"
Write-Verbose "zipalign = $zipalign"
Write-Verbose "zipalignLocation = $zipalignLocation"

# Import the Task.Common and Task.Internal dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Internal"
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

$jarsignApk = Convert-String $jarsign Boolean
Write-Verbose "jarsign (converted) = $jarsignApk"

$zipalignApk = Convert-String $zipalign Boolean
Write-Verbose "zipalign (converted) = $zipalignApk"

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

if (!$files)
{
    throw "Files parameter not set on script."
}

# check for files pattern
if ($files.Contains("*") -or $files.Contains("?"))
{
    Write-Verbose "Pattern found in files parameter. Calling Find-Files."
    Write-Verbose "Find-Files -SearchPattern $files"
    $filesToSign = Find-Files -SearchPattern $files
    Write-Verbose "filesToSign = $filesToSign"
}
else
{
    Write-Verbose "No Pattern found in project parameter."
    $filesToSign = ,$files
}

if (!$filesToSign)
{
    throw "No file with search pattern '$files' was found."
}

if ($jarsignApk)
{
    # verify parameters required for signing apk 
    $jarsigner = $env:JAVA_HOME + "\bin\jarsigner.exe"
    if (!(Test-Path -Path $jarsigner -PathType Leaf)) 
    {
        throw "Can not locate jarsigner.exe, please verify JAVA_HOME is properly configured on the build machine."	
    }	

    if (!$keystoreFile -or !(Test-Path -Path $keystoreFile -PathType Leaf)) 
    {
        throw "Please specify the keystore for signing APK and make sure it exists."
    }

    if (!$keystoreAlias) 
    {
        throw "Please specify the keystore alias."	
    }

    if ($keystorePass) 
    {
        $jarsignerArguments = "$jarsignerArguments -storepass $keystorePass" 
    }

    if ($keyPass) 
    {
        $jarsignerArguments = "$jarsignerArguments -keypass $keyPass" 
    }
}

if ($zipalignApk) 
{
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
}


foreach ($file in $filesToSign) 
{
    if ($jarsignApk)
    {
        # move the apk file so we do not pollute the work direcotry with multiple apks
        $unsignedApk = RenameExtension $file ".unsigned"

        $jarsignerArgs = "$jarsignerArguments -keystore `"$keystoreFile`" -signedjar $file $unsignedApk $keystoreAlias"
        
        Invoke-Tool -Path $jarsigner -Arguments $jarsignerArgs 
    }

    if ($zipalignApk)
    {
        $unalignedApk = RenameExtension $file ".unaligned"

        # alignment must be 4 or play store will reject, hard code this to avoid user errors
        $zipalignArgs = "-v 4 $unalignedApk $file" 

        Invoke-Tool -Path $zipaligner -Arguments $zipalignArgs
    }
}

Write-Verbose "Leaving script AndroidSigning.ps1"
