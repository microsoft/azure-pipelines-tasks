$AzureFileCopyRemoteJob = {
    param(
        [string] $ContainerURL,
        [string] $TargetPath,
        [string] $ContainerSASToken,
        [string] $AzCopyArgs,
        [string] $AzCopyToolFileNamesString,
        [string] $AzCopyToolFileContentsString,
        [string] $AzCopyToolRunner,
        [string] $_VerbosePreference,
        [switch] $CleanTargetBeforeCopy
    )
    $VerbosePreference = $_VerbosePreference
    $AzCopyToolRunner = [scriptblock]::Create($AzCopyToolRunner);

    function Get-ArgsForVMCopy {
        Param (
            [string] $JournalFileLocation
        )
        $res = "/Z:`"$JournalFileLocation`" /S /Y "
        Write-Verbose "AzCopy args for vm copy: '$res'"
        return $res
    }

    function ConvertTo-Files {
        Param (
            [Parameter(Mandatory = $true)]
            [string] $ParentDirectory
            [Parameter(Mandatory = $true)]
            [string[]] $FileNames,
            [Parameter(Mandatory = $true)]
            [string[]] $FileContents
        )
        Write-Verbose "Creating parent directory: $ParentDirectory"
        New-Item -ItemType Directory -Force -Path $ParentDirectory
        for ($i = 0 ; $i -lt $FileNames.Length ; $i++) {
            $filePath = Join-Path -Path $ParentDirectory -ChildPath $FileNames[$i]
            $content = [Convert]::FromBase64String($FileContents[$i])
            Write-Verbose "Creating file: '$filePath'"
            [System.IO.File]::WriteAllBytes($filePath, $content)
        }
        $fileCount = (Get-ChildItem -Path $ParentDirectory).Length
        Write-Verbose "'$fileCount' files have been created under the directory: '$ParentDirectory'"
    }

    function Clear-Directory {
        Param (
            [string] $Path,
            [switch] $IncludeRoot
        )
        if (Test-Path -Path $Path -PathType 'Container') {
            Get-ChildItem -Path $Path -Force | Remove-Item -Force -Recurse   
            Write-Host "Destination:'$Path' cleaned."
            if ($IncludeRoot) {
                Remove-Item -Path $Path -Force -ErrorAction 'SilentlyContinue'
            }
        } else {
            Write-Host "Unable to clear destination. '$Path' is not a container"
        }
    }

    try {        
        $AzCopyToolFileNames = $AzCopyToolFileNamesString.Split(";")
        $AzCopyToolFileContents = $AzCopyToolFileContentsString.Split(";")
        $azCopyFolder = "AFC_" + [Guid]::NewGuid().ToString()
        $azCopyLocation = Join-Path $env:WinDir -ChildPath "DtlDownloads\$azCopyFolder"
        ConvertTo-Files -ParentDirectory $azCopyLocation -FileNames $AzCopyToolFileNames -FileContents $AzCopyToolFileContents

        if($CleanTargetBeforeCopy) {
            Clear-Directory -Path $TargetPath
        }

        if ([string]::IsNullOrEmpty($AzCopyArgs.Trim())) {
            $AzCopyArgs = Get-ArgsForVMCopy -JournalFileLocation $azCopyLocation
            $logFilePath = Join-Path -Path $azCopyLocation -ChildPath ("AzCopyVerbose_" + [guid]::NewGuid() + ".log")
        }

        $azCopyExeLocation = Join-Path -Path $azCopyLocation -ChildPath "AzCopy.exe"
        & $AzCopyToolRunner -AzCopyExeLocation $azCopyExeLocation `
                            -Source $ContainerURL `
                            -Destination $TargetPath `
                            -TypeOfTransfer 'download' `
                            -AuthScheme 'SASToken' `
                            -AuthToken $ContainerSASToken `
                            -AdditionalArguments $AzCopyArgs `
                            -AzCopyLogFilePath $logFilePath
    } finally {
        Clean-Directory -Path $azCopyLocation -IncludeRoot
    }
}