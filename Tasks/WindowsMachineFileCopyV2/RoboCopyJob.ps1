$CopyJob = {
param (
    [string]$fqdn, 
    [string]$sourcePath,
    [string]$targetPath,
    [object]$credential,
    [string]$cleanTargetBeforeCopy,
    [string]$additionalArguments,
    [string]$scriptRoot
    )
    Import-Module "$scriptRoot\ps_modules\VstsTaskSdk" 
    Import-VstsLocStrings -LiteralPath $scriptRoot/Task.json

    . "$scriptRoot/Utility.ps1"

    Write-Verbose "Entering script RobocopyJob.ps1"
    Write-Verbose "fqdn = $fqdn"
    Write-Verbose "sourcePath = $sourcePath"
    Write-Verbose "targetPath = $targetPath"
    Write-Verbose "credential = $credential"
    Write-Verbose "cleanTargetBeforeCopy = $cleanTargetBeforeCopy"
    Write-Verbose "additionalArguments = $additionalArguments"

    $sourcePath = $sourcePath.Trim().TrimEnd('\', '/')
    $targetPath = $targetPath.Trim().TrimEnd('\', '/')  
    $isFileCopy = Test-Path -Path $sourcePath -PathType Leaf
    $doCleanUp = $cleanTargetBeforeCopy -eq "true"

    $sourceDirectory = $sourcePath
    $filesToCopy = ""
    if($isFileCopy)
    {
        $sourceDirectory = Split-Path $sourcePath
        $filesToCopy = Split-Path $sourcePath -Leaf
    }
    
    function ThrowError
    {
        param(
            [string]$errorMessage,
            [string]$fqdn
        )
        
        $failMessage = (Get-VstsLocString -Key "WFC_CopyingFailedForResource" -ArgumentList $fqdn)
        throw "$failMessage`n$errorMessage"
    }
    
    function Validate-Null(
        [string]$value,
        [string]$variableName
        )
    {
        $value = $value.Trim()    
        if(-not $value)
        {
            ThrowError -errorMessage (Get-VstsLocString -Key "WFC_ParameterCannotBeNullorEmpty" -ArgumentList $variableName)
        }
    }
    
    function Validate-Credential(
        [object]$credential)
    {
        if($credential)
        {
            Validate-Null $credential.UserName "Username"
            Validate-Null $credential.Password "Password"                        
        }
        else
        {
            ThrowError -errorMessage (Get-VstsLocString -Key "WFC_ParameterCannotBeNullorEmpty" -ArgumentList "credential")
        }   
    }

    function Get-DownLevelLogonName(
        [string]$fqdn,
        [string]$userName
        )
    {
        if($userName  -like '.\*') {
            $userName = $userName.replace(".\","\")
            $userName = $fqdn+$userName
        }
        return $userName
    }

    function Replace-First(
        [string]$text,
        [string]$search, 
        [string]$replace
        )
    {
        $pos = $text.IndexOf($search);
        if ($pos -le 0)
        {
            return $text;
        }

        return $text.Substring(0, $pos) + $replace + $text.Substring($pos + $search.Length);
    }

    function Clean-Target
    {
        $cleanupArgument = "/NOCOPY /E /PURGE" 
        $guid = [GUID]::NewGuid()
        $tempDirectory = "$scriptRoot\temp$guid" 
        New-Item -ItemType Directory -Force -Path $tempDirectory         
        Invoke-Expression "robocopy `"$tempDirectory`" `"$destinationNetworkPath`" `"*.*`" $cleanupArgument"
        Remove-Item $tempDirectory -Recurse -ErrorAction Ignore
    }

    function Get-DestinationNetworkPath(
        [string]$targetPath,
        [string]$machineShare
    )
    {
        if(-not $machineShare)
        {
            return $targetPath
        }

        $targetSpecificPath = Replace-First $targetPath ":" '$'    
        return [io.path]::Combine($machineShare, $targetSpecificPath)    
    }    

    function Get-RoboCopyParameters(
        [string]$additionalArguments,
        [switch]$fileCopy
        )
    {
        $robocopyParameters = "/COPY:DAT "

        if(-not $fileCopy.IsPresent)
        {
            $robocopyParameters += " /E"
        }       
        
        if (-not [string]::IsNullOrWhiteSpace($additionalArguments))
        {
            $robocopyParameters += " $additionalArguments"
        }

        return $robocopyParameters.Trim()
    }

    function Get-MachineShare(
        [string]$fqdn,
        [string]$targetPath
        )
    {
        if([bool]([uri]$targetPath).IsUnc)
        {
            return $targetPath
        }
        if($fqdn)
        {
            return [IO.Path]::DirectorySeparatorChar + [IO.Path]::DirectorySeparatorChar + $fqdn
        }

        return ""
    }

    function Create-DestinationDirectory(
        [string]$path
    )
    {
        $destPath = $path
        $foundParentPath = $false
        $isRoot = $false

        Write-Verbose "Creating path to directory: $path"
        while($destPath -and (-not $foundParentPath))
        {
            try
            {
                New-PSDrive -Name WFCPSDrive -PSProvider FileSystem -Root $destPath -Credential $psCredentialObject -ErrorAction 'Stop'
                $foundParentPath = $true
                Write-Verbose "Found parent path"
                $relativePath = $path.Substring($destPath.Length)
                New-Item -ItemType Directory WFCPSDrive:$relativePath -ErrorAction 'Stop' -Force
                Write-Verbose "Created directory"
            }
            catch 
            {
                Write-Verbose "Caught exception: $_.Exception.Message"
                $parentPath = Split-Path -Path $destPath -Parent
                if(($parentPath.Length -eq 0) -and ($isRoot -eq $false))
                {
                    $destPath = [IO.Path]::DirectorySeparatorChar + [IO.Path]::DirectorySeparatorChar + ([System.Uri]($destPath)).Host
                    $isRoot = $true
                    Write-Verbose "Check if root path exists: $destPath"
                }
                else
                {
                    $destPath = $parentPath
                    Write-Verbose "Check if parent path exists: $destPath"
                }
            }
            finally
            {
                if($foundParentPath -eq $true)
                {
                    Remove-PSDrive -Name WFCPSDrive
                }
            }
        }
    }

    if ($credential)
    {
        Validate-Credential $credential
        $userName = Get-DownLevelLogonName -fqdn $fqdn -userName $($credential.UserName)
        $password = $($credential.Password)  
        $psCredentialObject = New-Object pscredential -ArgumentList $userName, (ConvertTo-SecureString -String $password -AsPlainText -Force)
    }
   
    $machineShare = Get-MachineShare -fqdn $fqdn -targetPath $targetPath    
    $destinationNetworkPath = Get-DestinationNetworkPath -targetPath $targetPath -machineShare $machineShare

    Write-Verbose "machine share= $machineShare"
    Write-Verbose "destination network path= $destinationNetworkPath"

    Create-DestinationDirectory -path $destinationNetworkPath

    if($machineShare)
    {
        try {
            New-PSDrive -Name "WFCPSDrive" -PSProvider FileSystem -Root $destinationNetworkPath -Credential $psCredentialObject -ErrorAction 'Stop'
        } catch {
            Write-VstsTaskError -Message (Get-VstsLocString -Key "WFC_FailedToCreatePSDrive" -ArgumentList $destinationNetworkPath, $($_.Exception.Message)) -ErrCode "WFC_FailedToCreatePSDrive"
            throw
        }
    }

    if($doCleanUp)
    {
        Clean-Target
    }

    try
    {
        $robocopyParameters = Get-RoboCopyParameters -additionalArguments $additionalArguments -fileCopy:$isFileCopy

        $command = "robocopy `"$sourceDirectory`" `"$destinationNetworkPath`" `"$filesToCopy`" $robocopyParameters"
        Invoke-Expression $command
        if ($LASTEXITCODE -ge 8)
        {
            $errorMessage = Get-VstsLocString -Key "WFC_CopyingFailedConsultRobocopyLogsForMoreDetails"
            ThrowError -errorMessage $errorMessage -fqdn $fqdn
        }
        else
        {
            $message = (Get-VstsLocString -Key "WFC_CopyingRecurivelyFrom0to1MachineSucceed" -ArgumentList $sourcePath, $targetPath, $fqdn)
            Write-Output $message
        }
    }
    finally
    {
        if ($machineShare)
        {
            $remoteSharePsDrive = Get-PSDrive -Name 'WFCPSDrive' -ErrorAction 'SilentlyContinue'
            if ($remoteSharePsDrive -ne $null)
            {
                $remoteSharePath = $remoteSharePsDrive.Root
                Write-Verbose "Attempting to remove PSDrive 'WFCPSDrive'"
                Remove-PSDrive -Name 'WFCPSDrive' -Force
                Write-Verbose "RemoteSharePath: $remoteSharePath"
                Try-CleanupPSDrive -Path $remoteSharePath
            }
        }
    }
}
