$AzureFileCopyRemoteJob = {
    param(
        [string]$containerURL,
        [string]$targetPath,
        [string]$additionalArguments,
        [switch]$CleanTargetBeforeCopy,
        [switch]$EnableDetailedLogging,
        [switch]$useSanitizerActivate,
        [switch]$useSourcePathHardening
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

    function Split-AdditionalArguments
    {
        # Split-AdditionalArguments-Placeholder
    }

    # Replaces only $env:NAME and ${env:NAME} with the value of that environment variable (an unset
    # variable becomes an empty string). It is a single pass: the value is never expanded again, and
    # nothing else in the text is evaluated. The "env:" keyword is matched case-insensitively
    # (e.g. $env:NAME, $Env:NAME, $ENV:NAME, ${ENV:NAME}) to match PowerShell's native behavior.
    function Expand-EnvironmentReferences
    {
        param([string]$text)

        return [regex]::Replace($text,
            '(?i)\$(?:env:(?<n>[A-Za-z_][A-Za-z0-9_]*)|\{env:(?<n>[^}]+)\})',
            { param($m) [string][Environment]::GetEnvironmentVariable($m.Groups['n'].Value) })
    }

    try
    {
        $env:AZCOPY_AUTO_LOGIN_TYPE = "PSCRED"

        $useDefaultArguments = ($additionalArguments -eq "")

        # Argument to check whether azcopy.exe needs to be downloaded on VM or it is already present on VM
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
            if([version]$azCopyVersion -lt [version]"10.25.1")
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
                $webclient.DownloadFile('https://vstsagenttools.blob.core.windows.net/tools/azcopy/10.25.1/AzCopy.zip',$azCopyZipPath)

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
                throw "Failed while downloading azcopy.exe from the URL with exception $exceptionMessage. Please download azcopy.exe 10.25.1 and set this extracted path in env:Path"
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

        if ($useSourcePathHardening) {
            $sanitizedArguments = @(Split-AdditionalArguments -additionalArguments $additionalArguments)
            Write-DetailLogs "##[command] & azcopy copy `"$containerURL`" `"$targetPath`" $sanitizedArguments"
            & azcopy copy "$containerURL/*" "$targetPath" @sanitizedArguments
        } elseif ($useSanitizerActivate) {
            # Splitting arguments on space, but not on space inside quotes
            $sanitizedArguments = [regex]::Split($additionalArguments, ' (?=(?:[^"]|"[^"]*")*$)')
            Write-DetailLogs "##[command] & azcopy copy `"$containerURL`" `"$targetPath`" $sanitizedArguments"
            & azcopy copy "$containerURL/*" "$targetPath" $sanitizedArguments
        } else {
            # Legacy path (both feature flags off). TargetPath, ContainerURL and the additional arguments
            # reach azcopy as data: the arguments are split into a list by a parser that evaluates nothing,
            # and the call below is constant text that only references that list by name, so no value is
            # ever re-parsed as PowerShell. Only $env:NAME and ${env:NAME} are expanded (in the target path
            # and in each argument); azcopy options themselves, including quoted values, work as before.
            $expandedTargetPath = Expand-EnvironmentReferences $targetPath
            [string[]]$argumentTokens = @(@(Split-AdditionalArguments -additionalArguments $additionalArguments) |
                ForEach-Object { Expand-EnvironmentReferences $_ })
            [string[]]$azCopyArguments = @('copy', "$containerURL/*", $expandedTargetPath) + $argumentTokens
            Write-DetailLogs "##[command] & azcopy copy `"$containerURL`" `"$expandedTargetPath`" $argumentTokens"
            & azcopy @azCopyArguments
        }
    }
    catch
    {
        Write-Verbose "AzureFileCopyRemoteJob threw exception"
        throw
    }
}