function DownloadTestPlatform {
    param
    (
        [String] $ProductVersion
    )

    . $PSScriptRoot\CheckTestAgentInstallation.ps1

    # Check if test agent is already installed 
    $isTaInstalled = CheckInstallation -ProductVersion $ProductVersion
    if(-Not $isTaInstalled) {
        # Import Agent installation helpers
        . $PSScriptRoot\DownloadTestAgent.ps1
        . $PSScriptRoot\TestAgentInstall.ps1

        $sourcePath = "https://go.microsoft.com/fwlink/?LinkId=615472"
        $destPath = Join-Path "$env:SystemDrive" "TestAgent"
        $taPath = Join-Path $destPath "vstf_testagent.exe"

        Write-Verbose "Test Agent is not installed. It will be downloaded and installed"
        Write-Host "Downloading from $sourcePath to $destPath"
        
        DownloadTestAgent -SourcePath $sourcePath -DestinationPath $destPath
        $installationCode = Install-Product -SetupPath $taPath -ProductVersion "14.0" -Arguments "/Quiet /NoRestart"
        
        Write-Host "Test Agent installation is completed with code: $installationCode" 
    }
}

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

# $sourcePath is the semi colon separated set of  paths from which the test agent/msi is to be downloaded or copied.
# $destinationPath is the semi colon separated set of location to which the test agent/msi will be downloaded or copied.
function DownloadAgent {
    param
    (
        [String] $sourcePath,
        [String] $destinationPath
    )
    
    $source = $sourcePath.Split(";")
    $counter = 0;
    $destinationFile = $destinationPath.Split(";")

    foreach($sourcePath in $source)
    {
        Write-Verbose $sourcePath -Verbose
        # Check if the given path is a valid Uri
        $isUri = [System.Uri]::IsWellFormedUriString($sourcePath, [System.UriKind]::Absolute)

        # Download the test agent to desired location if source path is Uri
        if($isUri)
        {
            # Create the parent directory if it does not exist
            $destinationDirectory = Split-Path -Path $destinationFile[$counter] -Parent
            $isPresent = Test-Path $destinationDirectory
            if(!$isPresent)
            {
                New-Item -ItemType Directory -Path $destinationDirectory
            }

            Write-Verbose -Message "Downloading test agent from $sourcePath to test machine." -Verbose
            Invoke-WebRequest $sourcePath -OutFile $destinationFile[$counter]
            $counter++
        }
        else
        {
            ValidateSourceFile($sourcePath)
            $sourceDirectory = Split-Path -Path $sourcePath -Parent
            $sourceFileName = Split-Path -Path $sourcePath -Leaf

            Write-Verbose -Message "Copying file from $sourcePath to test machine." -f $sourcePath
            Write-Verbose "robocopy $sourceDirectory $destinationDirectory $sourceFileName /Z /mir /NP /Copy:DAT /R:10 /W:30" -Verbose
            robocopy $sourceDirectory $destinationDirectory $sourceFileName /Z /mir /NP /Copy:DAT /R:10 /W:30
            # If robo copy exits with non zero exit code then throw exception.
            $robocopyExitCode = $LASTEXITCODE 
            if($robocopyExitCode -eq 0x10)
            {
                throw "Robocopy failed to copy from $sourceDirectory to $destinationDirectory. Failed with a exit code $robocopyExitCode."
            }
        }
    }
}