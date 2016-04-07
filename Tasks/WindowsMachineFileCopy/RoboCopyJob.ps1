$CopyJob = {
param (
    [string]$fqdn, 
    [string]$sourcePath,
    [string]$targetPath,
    [object]$credential,
    [string]$cleanTargetBeforeCopy,
    [string]$additionalArguments
    )    

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

    Get-ChildItem $env:AGENT_HOMEDIRECTORY\Agent\Worker\*.dll | % {
    [void][reflection.assembly]::LoadFrom( $_.FullName )
    Write-Verbose "Loading .NET assembly:`t$($_.name)" -Verbose
    }
    import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"
    
    function ThrowError
    {
        param(
            [string]$errorMessage,
            [string]$fqdn
        )
        
        $failMessage = "Copying failed for resource : $fqdn"
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
            ThrowError -errorMessage (Get-LocalizedString -Key "Parameter '{0}' cannot be null or empty." -ArgumentList $variableName)
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
            ThrowError -errorMessage (Get-LocalizedString -Key "Parameter '{0}' cannot be null or empty." -ArgumentList "credential")
        }   
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
        [switch]$fileCopy,
        [switch]$clean)
    {
        $robocopyParameters = "/COPY:DAT"

        if(-not $fileCopy.IsPresent)
        {
            if($clean.IsPresent)
            {
                $robocopyParameters += " /MIR"
            }
            else
            {
                $robocopyParameters += " /E"
            }
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
    
    $machineShare = Get-MachineShare -fqdn $fqdn -targetPath $targetPath    
    $destinationNetworkPath = Get-DestinationNetworkPath -targetPath $targetPath -machineShare $machineShare
    
    Validate-Credential $credential
    $userName = $($credential.UserName)
    $password = $($credential.Password) 

    if($machineShare)
    {
        $command = "net use `"$machineShare`""
        if($userName)
        {
            $command += " /user:`"$userName`" `'$($password -replace "['`]", '$&$&')`'"
        }
        $command += " 2>&1"
        
        $dtl_mapOut = iex $command
        if ($LASTEXITCODE -ne 0) 
        {
            $errorMessage = (Get-LocalizedString -Key "Failed to connect to the path {0} with the user {1} for copying.`n" -ArgumentList $machineShare, $($credential.UserName)) + $dtl_mapOut
            ThrowError -errorMessage $errorMessage -fqdn $fqdn
        }
    }

    try
    {
        if($isFileCopy -and $doCleanUp -and (Test-Path -path $destinationNetworkPath -pathtype container))
        {
            Get-ChildItem -Path $destinationNetworkPath -Recurse -force | Remove-Item -force -recurse;
            $output = Remove-Item -path $destinationNetworkPath -force -recurse 2>&1
            $err = $output | ?{$_.gettype().Name -eq "ErrorRecord"}
            if($err)
            {
                Write-Verbose -Verbose "Error occurred while deleting the destination folder: $err"
            }
        }

        $robocopyParameters = Get-RoboCopyParameters -additionalArguments $additionalArguments -fileCopy:$isFileCopy -clean:$doCleanUp

        $command = "robocopy `"$sourceDirectory`" `"$destinationNetworkPath`" `"$filesToCopy`" $robocopyParameters"                
        Invoke-Expression $command        
        
        if ($LASTEXITCODE -ge 8)
        {
            $errorMessage = Get-LocalizedString -Key "Copying failed. Consult the robocopy logs for more details."            
            ThrowError -errorMessage $errorMessage -fqdn $fqdn            
        }
        else
        {            
            $message = (Get-LocalizedString -Key "Copying recursively from {0} to {1} on machine {2} succeeded" -ArgumentList $sourcePath, $targetPath, $fqdn)
            Write-Output $message            
        }        
    }
    finally
    {
        if($machineShare)
        {
            net use $machineShare /D /Y;  
        }
    }
}
