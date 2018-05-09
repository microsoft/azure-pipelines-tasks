$AzureFileCopyRemoteJob = {
    param(
        [string]$containerURL,
        [string]$targetPath,
        [string]$containerSasToken,
        [string]$additionalArguments,
        [string]$azCopyToolFileNamesString,
        [string]$azCopyToolFileContentsString,
        [switch]$CleanTargetBeforeCopy,
        [switch]$EnableDetailedLogging
    )

    function Get-AzCopyVerboseLogs
    {
        [CmdletBinding()]
        param(
            [string]$logFilePath,
            [bool]$printLogs
        )

        if($printLogs -and $EnableDetailedLogging)
        {
            Get-Content -Path $logFilePath | Write-Verbose
        }
    }

    function Remove-AzCopyFolder
    {
        [CmdletBinding()]
        param([string]$azCopyLocation)

        $tempParentFolder = (Get-Item $azCopyLocation).Parent.FullName

        Get-ChildItem -Path $azCopyLocation -Recurse -Force | Remove-Item -Force -Recurse
        Remove-Item $azCopyLocation -Force

        Remove-Item $tempParentFolder -Force
    }

    try
    {
        $azCopyToolFileNames = $azCopyToolFileNamesString.Split(";")
        $azCopyToolFileContents = $azCopyToolFileContentsString.Split(";")

        $randomFolderName = "AFC_" + [guid]::NewGuid()
        $randomFolderPath = Join-Path -Path $env:windir -ChildPath "DtlDownloads\$randomFolderName"
        $azCopyDestinationPath = Join-Path -Path $randomFolderPath -ChildPath "AzCopy"
        New-Item -ItemType Directory -Force -Path $azCopyDestinationPath

        for($i=0; $i -lt $azCopyToolFileNames.Length; $i++)
        {
            $path = Join-Path -Path $azCopyDestinationPath -ChildPath $azCopyToolFileNames[$i]
            $content = [Convert]::FromBase64String($azCopyToolFileContents[$i])
            [System.IO.File]::WriteAllBytes($path, $content)
        }

        if($CleanTargetBeforeCopy)
        {
            Get-ChildItem -Path $targetPath -Recurse -Force | Remove-Item -Force -Recurse
        }

        $azCopyExeLocation = Join-Path -Path $azCopyDestinationPath -ChildPath "AzCopy.exe"

        $logFileName = "AzCopyVerbose_" + [guid]::NewGuid() + ".log"
        $logFilePath = Join-Path -Path $azCopyDestinationPath -ChildPath $logFileName
        $useDefaultArguments = $false

        if($additionalArguments -eq "")
        {
            # Adding default optional arguments:
            # /Z: Journal file Location
            # /V: AzCopy verbose logs file location
            # /S: Recursive copy
            # /Y: Suppresses all AzCopy confirmation prompts
            $additionalArguments = "/Z:`"$azCopyDestinationPath`" /V:`"$logFilePath`" /S /Y"
            $useDefaultArguments = $true
        }

        $azCopyCommand = "& `"$azCopyExeLocation`" /Source:$containerURL /Dest:`"$targetPath`" /SourceSAS:`"$containerSasToken`" $additionalArguments"
        Invoke-Expression $azCopyCommand
    }
    finally
    {
        # Print AzCopy.exe verbose logs
        Get-AzCopyVerboseLogs -logFilePath $logFilePath -printLogs $useDefaultArguments -ErrorAction SilentlyContinue

        # Delete AzCopy tool folder
        Remove-AzCopyFolder -azCopyLocation $azCopyDestinationPath -ErrorAction SilentlyContinue
    }
}