$AzureFileCopyRemoteJob = {
    param(
        [string]$containerURL,
        [string]$targetPath,
        [string]$containerSasToken,
        [string]$additionalArguments,
        [string]$azCopyToolFileNamesString,
        [string]$azCopyToolFileContentsString,
        [switch]$CleanTargetBeforeCopy
    )

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

        if($cleanTargetBeforeCopy)
        {
            Get-ChildItem -Path $targetPath -Recurse -Force | Remove-Item -Force -Recurse
        }

        $azCopyExeLocation = Join-Path -Path $azCopyDestinationPath -ChildPath "AzCopy.exe"

        if($additionalArguments -eq "")
        {
            # Adding default optional arguments:
            # /Z: Journal file Location
            # /S: Recursive copy
            # /Y: Suppresses all AzCopy confirmation prompts
            $additionalArguments = "/Z:`"$azCopyDestinationPath`" /S /Y"
        }

        $azCopyCommand = "& `"$azCopyExeLocation`" /Source:$containerURL /Dest:`"$targetPath`" /SourceSAS:`"$containerSasToken`" $additionalArguments"
        Invoke-Expression $azCopyCommand
    }
    finally
    {
        # Delete AzCopy tool folder
        Get-ChildItem -Path $azCopyDestinationPath -Recurse -Force | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue
        Remove-Item $azCopyDestinationPath -Force -ErrorAction SilentlyContinue
        Remove-Item $randomFolderPath -Force -ErrorAction SilentlyContinue
    }
}