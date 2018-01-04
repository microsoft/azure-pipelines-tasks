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
        $cleanupArgument = "/NOCOPY /PURGE" 
        $guid = [GUID]::NewGuid()
        $tempDirectory = "$scriptRoot\temp$guid" 
        New-Item -ItemType Directory -Force -Path $tempDirectory         
        Invoke-Expression "robocopy `"$sourceDirectory`" `"$destinationNetworkPath`" `"*.*`" $cleanupArgument"
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
    
    function Get-NetExeCommand
    {
        $netExePath = Join-Path -path (get-item env:\windir).value -ChildPath system32\net.exe
        if(Test-Path $netExePath)
        {
            Write-Verbose "Found the net exe path $netExePath. Net command will be $netExePath"
            return $netExePath
        }
        
        Write-Verbose "Unable to get the path for net.exe. Net command will be 'net'"
        return 'net'
    }
    
    $machineShare = Get-MachineShare -fqdn $fqdn -targetPath $targetPath    
    $destinationNetworkPath = Get-DestinationNetworkPath -targetPath $targetPath -machineShare $machineShare
    
    Validate-Credential $credential
    $userName = Get-DownLevelLogonName -fqdn $fqdn -userName $($credential.UserName)
    $password = $($credential.Password) 
    
    $netExeCommand = Get-NetExeCommand

    if($machineShare)
    {
        $command = "$netExeCommand use `"$machineShare`""
        if($userName)
        {
            $command += " /user:`'$userName`' `'$($password -replace "['`]", '$&$&')`'"
        }
        $command += " 2>&1"
        
        $dtl_mapOut = iex $command
        if ($LASTEXITCODE -ne 0) 
        {
            $errorMessage = (Get-VstsLocString -Key "WFC_FailedToConnectToPathWithUser" -ArgumentList $machineShare, $($credential.UserName)) + $dtl_mapOut
            ThrowError -errorMessage $errorMessage -fqdn $fqdn
        }
    }

    try
    {
        if($doCleanUp)
        {
           Clean-Target
        }

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
        if($machineShare)
        {            
            $dtl_deleteMap = iex "$netExeCommand use `"$machineShare`" /D /Y";  
        }
    }
}
