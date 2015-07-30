# DownloadTestAgent.ps1 takes two parameters , sourcePath and destinationPath
# $sourcePath is the path from which the test agent is to be downloaded or copied.
# $destinationPath is the location to which the test agent will be downloaded or copied.

# Validate that the given source path exists and is not a directory.
function ValidateSourceFile([string] $sourcePath)
{
   if(! (Test-Path -Path $sourcePath))
   {
         throw "Test agent source path '{0}' is not accessible to the test machine. Please check if the file exists and that test machine has access to that machine" -f $sourcePath
   }
   if((Get-Item $sourcePath) -is [System.IO.DirectoryInfo])
   {
          throw "Please provide the source path of test agent till the installation file. Given path is {0}" -f $sourcePath
   }
}

# Create the parent directory if it does not exist
$destinationDirectory = Split-Path -Path $destinationPath -Parent
$isPresent = Test-Path $destinationDirectory
if(!$isPresent)
{
    New-Item -ItemType Directory -Path $destinationDirectory
}

# Check if the given path is a valid Uri
$isUri = [System.Uri]::IsWellFormedUriString($sourcePath, [System.UriKind]::Absolute)

# Download the test agent to desired location if source path is Uri
if($isUri)
{
   Write-Verbose -Message "Downloading test agent from $sourcePath to test machine."
   Invoke-WebRequest $sourcePath -OutFile $destinationPath
}
else
{
   / ValidateSourceFile($sourcePath)
    $sourceDirectory = Split-Path -Path $sourcePath -Parent
    $sourceFileName = Split-Path -Path $sourcePath -Leaf

    Write-Verbose -Message "Copying file from $sourcePath to test machine." -f $sourcePath
    robocopy $sourceDirectory $destinationDirectory $sourceFileName /Z /mir /NP /Copy:DAT /R:10 /W:30
    # If robo copy exits with non zero exit code then throw exception.
    $robocopyExitCode = $LASTEXITCODE 
    if($robocopyExitCode -eq 0x10)
    {
         throw "Robocopy failed to copy fail from $sourceDirectory to $destinationDirectory with a exit code $robocopyExitCode."
    }
}