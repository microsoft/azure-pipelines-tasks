$AzureFileCopyRemoteJob = {
    param(
        [string]$containerURL,
        [string]$targetPath,
        [string]$containerSasToken,
        [string]$additionalArguments,
        [switch]$CleanTargetBeforeCopy,
        [switch]$EnableDetailedLogging
    )

    function Write-DetailLogs
    {
        [CmdletBinding()]
        param(
            [string]$message
        )

        if($EnableDetailedLogging)
        {
            Write-Verbose $message
        }
    }

    try
    {
        $useDefaultArguments = ($additionalArguments -eq "")

        #argument to check whether azcopy.exe needs to be downloaded on VM or it is already present on VM
        $shouldDownload = $false

        if($CleanTargetBeforeCopy)
        {
            if (Test-Path $targetPath -PathType Container)
            {
                Get-ChildItem -Path $targetPath -Recurse -Force | Remove-Item -Force -Recurse
                Write-DetailLogs "Destination location cleaned"
            }
            else
            {
                Write-DetailLogs "Folder at path $targetPath not found for cleanup."
            }
        }

        try
        {
            $azCopyVersionCommand = azcopy --version
            $azCopyVersion = $azCopyVersionCommand.split(' ')[2]
            if([version]$azCopyVersion -lt [version]"10.12.2")
            {
                $shouldDownload = $true
            }
        }
        catch
        {
            $shouldDownload = $true
        }

        if($shouldDownload)
        {
            try
            {
                $azCopyFolderName = "ADO_AzCopyV10"
                $azCopyFolderPath = Join-Path -Path $env:systemdrive -ChildPath $azCopyFolderName

                New-Item -ItemType Directory -Force -Path $azCopyFolderPath
                $azCopyZipPath = Join-Path -Path $azCopyFolderPath -ChildPath "AzCopy.zip"

                # Downloading AzCopy from URL and copying it in $azcopyZipPath
                $webclient = New-Object System.Net.WebClient
                $webclient.DownloadFile('https://vstsagenttools.blob.core.windows.net/tools/azcopy/10.12/AzCopy.zip',$azCopyZipPath)

                #Unzipping the azcopy zip to $azcopyFolderPath
                Expand-Archive $azCopyZipPath -DestinationPath $azCopyFolderPath -Force

                $azCopyFolderEnvPath = Join-Path -Path $azCopyFolderPath -ChildPath "AzCopy"

                #setting path at machine level so that when user again do copy on VM, there is no need to download the azcopy.exe again
                [Environment]::SetEnvironmentVariable("Path", $azCopyFolderEnvPath + ';' + $env:Path, [System.EnvironmentVariableTarget]::Machine)

                #setting $env:Path at user level to include azcopy.exe path as the above command used do set the path at machine level and not at user level
                $env:Path = $azCopyFolderEnvPath + ';' + $env:Path
            }
            catch
            {
                $exceptionMessage = $_.Exception.Message.ToString()
                throw "Failed while downloading azcopy.exe from the URL with exception $exceptionMessage. Please download azcopy.exe 10.12.2 and set this extracted path in env:Path"
            }
        }

        if($useDefaultArguments)
        {
            # Adding default optional arguments:
            # log-level: Defines the log verbosity for the log file. Default is INFO(all requests/responses)
            # recursive: Recursive copy

            Write-DetailLogs "Using default AzCopy arguments for dowloading to VM"
            $additionalArguments = "--recursive --log-level=INFO"
        }

        Write-DetailLogs "##[command] & azcopy copy `"$containerURL*****`" `"$targetPath`" $additionalArguments"

        $azCopyCommand = "& azcopy copy `"$containerURL/*$containerSasToken`" `"$targetPath`" $additionalArguments"
        Invoke-Expression $azCopyCommand
    }
    catch
    {
        Write-Verbose "AzureFileCopyRemoteJob threw exception"
        throw
    }
}
