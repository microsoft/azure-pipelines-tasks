$RunSCVMMRestoreVMJob = {
    param (
    [string]$vmName, 
    [string]$scvmmServerName,
    [string]$scvmmServerPort,
    [System.Management.Automation.PSCredential]$scvmmPSCredential,
    [string]$scvmmFilteringScope,
    [string]$scvmmFilteringScopeValue,
    [string]$checkPointName,
    [string[]]$powershellModulesToLoad,
    [string[]]$powershellScriptsToLoad
    )

    foreach ($psModule in $powershellModulesToLoad) {
        if ( Test-Path $psModule )
        { 
            write-verbose " Importing SCVMM related modules from $scvmmModulePath in context of job $($psModule)" -verbose
            Import-Module -Name $psModule
        } 
        else
        {
            write-warning "Unable to import $psModule from restore action job. Ensure path is valid and accessible "
        }
    }

    foreach ($psScript in $powershellScriptsToLoad) {
        
        if ( Test-Path $psScript )
        { 
            write-verbose " Loading the PS script - $psScript in job context " -verbose
            . $psScript
        } 
        else
        {
            write-warning "Unable to load $psScript from restore action job . Ensure path is valid and accessible"
        }
    }


    $CloudFiltering = "CloudFiltering"
    $HostFiltering = "HostFiltering"

    $vm = $null;
    $result = @{}
    $result.Action = "RestoreCheckPoint"
    $result.VMName = $vmName
    $scvmmCloud = $null
    $scvmmHost = $null
    $scvmmServerConnection = $null
    
    function GetConnection
    {
        
        $scvmmServerConnection = GetSCVMMServerConnection -scvmmServerName $scvmmServerName -scvmmCredential $scvmmPSCredential -scvmmServerPort $scvmmServerPort
        
        if(!$scvmmServerConnection)
        {
            throw "Unable to establish the connection with scvmm server $scvmmServerName on port $scvmmServerPort with provided credential"
        }
        
        write-Output $scvmmServerConnection
    }

    function GetVMWithGivenScope
    {           

        param(
        [Parameter(Mandatory=$true)]
        [object]$scvmmServerConnection
        )
        
        if($scvmmFilteringScope -eq $CloudFiltering )
        {
            write-verbose " Get cloud object for $scvmmFilteringScopeValue" -verbose
            $scvmmCloud = GetCloud -cloudName $scvmmFilteringScopeValue -scvmmServerConnection $scvmmServerConnection
            
            if(!$scvmmCloud)
            {
                throw "Unable to get the cloud - $scvmmFilteringScopeValue with $scvmmServerName. Ensure you provide the correct cloud name"
            }    

            Write-Verbose "Retrieve vm - $vmName details with cloud - $scvmmFilteringScopeValue" -Verbose
            $vm = GetVMWithinCloud -vmName $vmName -scvmmServerConnection $scvmmServerConnection -cloud $scvmmCloud
        }
        elseif($scvmmFilteringScope -eq $HostFiltering )
        {
            write-verbose " Get host object for $scvmmFilteringScopeValue" -verbose
            $scvmmHost = GetHost -hostName $scvmmFilteringScopeValue -scvmmServerConnection $scvmmServerConnection
            
            if(!$scvmmHost)
            {
                throw "Unable to get the host - $scvmmFilteringScopeValue with $scvmmServerName. Ensure you provide the correct host name"
            }
            
            Write-Verbose "Retrieve vm - $vmName details with host - $scvmmFilteringScopeValue" -Verbose
            $vm = GetVMWithinHost -vmName $vmName -scvmmServerConnection $scvmmServerConnection -vmHost $scvmmhost
        }else
        {
            Write-Verbose "Retrieve vm - $vmName details" -Verbose
            $vm = GetVM -vmName $vmName -scvmmServerConnection $scvmmServerConnection
        }    
        
        if(!$vm)
        {
            throw " Unable to get $vmName "
        }
        
        write-Output $vm
    }
    
    try
    {
        write-verbose " Creating connection with SCVMM server $scvmmServerName on port $scvmmServerPort" -verbose
        $scvmmServerConnection = GetConnection
        write-verbose " Connection with SCVMM server $scvmmServerName on port $scvmmServerPort is made, now get the VM - $vmName" -verbose
        
        $vm = GetVMWithGivenScope -scvmmServerConnection $scvmmServerConnection
        
        if($vm.Count -gt 1)
        {
            $result.Status = "failed"
            $result.ErrorMessage = " There are $($vm.Count) VMs found for name - $vmName. The operation can be done a machine having unique name for given Cloud or Host"

            Write-Output $result
            return
        }
    }
    catch
    {
        $result.Status = "failed"
        $result.Exception = $_.Exception
        $result.ErrorMessage = $_.Exception.Message
        
        Write-Output $result        
        return
    }
    
    Write-Verbose "Retrieving checkpoint - $checkPointName details for $vmName" -Verbose
    try
    {
        $checkPoint = GetCheckPoint -scvmmVM $vm -scvmmServerConnection $scvmmServerConnection -checkPointName $checkPointName
        if(!$checkPoint)
        {
            $result.Status = "failed"
            $result.ErrorMessage = " Unable to get checkpoint -$checkPointName details for $vmName"
            
            Write-Output $result
            return
        }
        
        Write-Verbose "Restoring vm - $vmName to checkpoint-$checkPointName" -Verbose

        $res = RestoreCheckPoint -checkPoint $checkPoint
        
    }
    catch
    {
        $result.Status = "failed"
        $result.Exception = $_.Exception
        $result.ErrorMessage = $_.Exception.Message
        
        Write-Output $result
        return
    }
    
    $result.Status = "passed"
    $result.Message = "Vm -$vmName successfully restored back to checkpoint- $checkPointName "
    
    Write-Output $result
}
