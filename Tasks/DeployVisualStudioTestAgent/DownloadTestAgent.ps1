# DownloadTestAgent.ps1 takes two parameters , sourcePath and destinationPath
# $sourcePath is the semi colon separated set of  paths from which the test agent/msi is to be downloaded or copied.
# $destinationPath is the semi colon separated set of location to which the test agent/msi will be downloaded or copied.

# Validate that the given source path exists and is not a directory.
function ValidateSourceFile([string] $sourcePath)
{
    if(! (Test-Path -Path $sourcePath))
    {
        throw "Test agent source path '{0}' is not accessible to the test machine. Please check if the file exists and that test machine has access to that machine" -f $sourcePath
    }
    
    if((Get-Item $sourcePath) -is [System.IO.DirectoryInfo])
    {
        throw "Provide the source path of test agent including the installation file. Given path is '{0}'" -f $sourcePath
    }
}

$source = $sourcePath.Split(";")
$counter = 0;
$destinationFile = $destinationPath.Split(";")

foreach($sourcePath in $source)
{
    Write-Verbose $sourcePath -Verbose
    # Check if the given path is a valid Uri
    $isUri = [System.Uri]::IsWellFormedUriString($sourcePath, [System.UriKind]::Absolute)
    
    #Get the destination Directory
    $destinationDirectory = Split-Path -Path $destinationFile[$counter] -Parent
   
    # Download the test agent to desired location if source path is Uri
    if($isUri)
    {
        # Create the parent directory if it does not exist
        $isPresent = Test-Path $destinationDirectory
        if(!$isPresent)
        {
            New-Item -ItemType Directory -Path $destinationDirectory
        }

        Write-Verbose -Message "Downloading test agent from $sourcePath to test machine." -Verbose
        Invoke-WebRequest $sourcePath -OutFile $destinationFile[$counter]
    }
    else
    {
        ValidateSourceFile($sourcePath)
        $sourceDirectory = Split-Path -Path $sourcePath -Parent
        $sourceFileName = Split-Path -Path $sourcePath -Leaf

        Write-Verbose -Message "Copying file from $sourcePath to test machine." -Verbose
        Write-Verbose "robocopy $sourceDirectory $destinationDirectory $sourceFileName /Z /MT /NP /Copy:DAT /R:10 /W:30" -Verbose
        robocopy $sourceDirectory $destinationDirectory $sourceFileName /Z /MT /NP /Copy:DAT /R:10 /W:30
        # If robo copy exits with non zero exit code then throw exception.
        $robocopyExitCode = $LASTEXITCODE 
        if($robocopyExitCode -eq 0x10)
        {
            throw "Robocopy failed to copy from $sourceDirectory to $destinationDirectory. Failed with a exit code $robocopyExitCode."
        }
    }
    $counter++
}