param (
[string][Parameter(Mandatory=$true)]$connectedServiceName,
[string][Parameter(Mandatory=$true)]$action,
[string][Parameter(Mandatory=$true)]$vmlist,
[string]$checkPointName,
[string]$scopeFilter,
[string]$cloudFilter,
[string]$hostFilter,
[string]$methodToInvoke = "Execute-Main"
)

Write-Host "Starting SCVMM Task..."

Write-Verbose "connectedServiceName = $connectedServiceName" -Verbose
Write-Verbose "action = $action" -Verbose
Write-Verbose "vmlist = $vmlist" -Verbose
Write-Verbose "checkPointName = $checkPointName" -Verbose
Write-Verbose "scopefilter = $scopeFilter" -Verbose
Write-Verbose "cloudFilter = $cloudFilter" -Verbose
Write-Verbose "hostFilter = $hostFilter" -Verbose


$ErrorActionPreference = 'Stop'
$SCVMMAdminConsoleInstallPathRegKey = "HKLM:\software\microsoft\Microsoft System Center Virtual Machine Manager Administrator Console\Setup"
$SCVMMDefaultPort = "8100"
$CloudFiltering = "CloudFiltering"
$HostFiltering = "HostFiltering"
$RestoreAction = "Restore"

$psmodulesToLoad = @()
$powershellScriptsToLoad = @()

### These to be initialized in 'DoPreOperations'           
[PSCredential]$scvmmCred = $null
$scvmmServerInfo = $null
$scvmmVMList = @()

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
. "$here\scvmmRestoreVMJob.ps1"

function GetSCVMMPlatform
{
    $here = get-location

    return $(Join-Path $here "scvmm2012R2Platform.ps1")
}

function GetSCVMMAdminConsoleInstallPath
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$regKeyPath
    )

    $path = [string]::Empty
    
    if( -not (Test-Path -Path $regKeyPath))
    {
        write-verbose "$regKeyPath is not available" -verbose
        return $path
    }
    
    try
    {
        $path = (Get-itemproperty -path $regKeyPath).InstallPath
    }
    catch
    {
        write-verbose "Error occurred while reading the 'InstallPath' from $regKeyPath... Details - $_.Exception.Message" -verbose
    }    
    
    return $path
}

function GetSCVMMModulePath
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$regKeyPath
    )
    
    $moduleSubPath =  'bin\psModules\virtualmachinemanager\virtualmachinemanager.psd1'
    
    $installedPath = GetSCVMMAdminConsoleInstallPath -regKeyPath $regKeyPath
    
    write-verbose "SCVVM admin console installed path - $installedPath" -verbose    
    
    $modulePath = Join-Path $installedPath $moduleSubPath

    write-verbose "SCVVM powershell modules path  - $modulePath" -verbose    

    return $modulePath
}

function GetSCVMMEndpointData
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$connectedServiceName
    )

    $serviceEndpoint = Get-ServiceEndpoint -Context $distributedTaskContext -Name $connectedServiceName
    
    if (!$serviceEndpoint)
    {
        throw "A Connected Service with name - '$ConnectedServiceName' could not be found.  Ensure that this Connected Service was successfully provisioned using the services tab in the Admin UI."
    }

    return $serviceEndpoint
}

function GetSCVMMConnectionCredential
{
    param(
    [Parameter(Mandatory=$true)]
    [object]$endpoint
    )

    $scvmmUserName = $endpoint.Authorization.Parameters.UserName

    $secpasswd = ConvertTo-SecureString $endpoint.Authorization.Parameters.Password -AsPlainText -Force
    $scvmmCred = New-Object System.Management.Automation.PSCredential ($scvmmUserName , $secpasswd)
    
    return $scvmmCred
}

function GetSCVMMVMList
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$scvmmVMList
    )
    
    $scvmmVMList = $scvmmVMList.Trim()
    $vmSplitList =   $scvmmVMList.split(',')
    
    $returnList = @()

    foreach ( $vm in $vmSplitList)
    {
        if(![string]::IsNullOrWhiteSpace($vm))
        {   
            $vm = $vm.Trim()
            write-verbose "Action to be done on VM - $vm" -verbose
            $returnList += $vm
            
            
        }
    }

    return $returnList    
}

function GetSCVMMServerInfo
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$scvmmServer
    )
    
    if([string]::IsNullOrWhiteSpace($scvmmServer))
    {
        throw "Ensure provided SCVMM server name is not empty."
    }
    
    write-verbose "Retrieving SCVMM server name and port. Given server details - $scvmmServer" -verbose
    $scvmmServerInfo = @{}
    
    $splitString = $scvmmServer.split(':')
    if([string]::IsNullOrWhiteSpace($splitString[0]))
    {
        throw "Unable to get the SCVMM server name"
    }
    $scvmmServerInfo.name = $splitString[0]
    write-host "SCVMM server name - $($splitString[0])"
    
    if([string]::IsNullOrWhiteSpace($splitString[1]))
    {
        $scvmmServerInfo.port = $SCVMMDefaultPort
        write-host "No port is provided for SCVMM server, default port $($SCVMMDefaultPort) will be used"
    }
    else
    {
        $scvmmServerInfo.port = $splitString[1]
    }
    
    write-host "SCVMM server port - $($splitString[1])" -verbose
    return $scvmmServerInfo
}

function LoadSCVMMPowershellModule
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$modulePathToLoad
    )
    
    $module = $null
    
    if ( Test-Path $modulePathToLoad )
    { 
        write-host " Importing SCVMM related modules from $scvmmModulePath "
        Import-Module $modulePathToLoad
        
        $module = $modulePathToLoad      
    } 
    else
    { 
        
        Write-Warning "Unable to find / load the Powershell modules for SCVMM. This may result into failure of all/some operations on SCVMM . Ensure 'Microsoft System Center Virtual Machine Manager Administrator Console' is installed on agent machine. " -Verbose
    }
    
    return $module
}

function DoPreOperations([ref]$psmodulesToLoad, [ref]$powershellScriptsToLoad, [ref]$scvmmCred, [ref]$scvmmServerInfo, [ref]$scvmmVMList)
{
    Write-Verbose "Doing required pre-operations" -Verbose
    
    Write-Verbose "Get SCVMM Powershell module path" -verbose
    
    $scvmmModulePath = GetSCVMMModulePath -regKeyPath $SCVMMAdminConsoleInstallPathRegKey 
    
    Write-Verbose "Load SCVMM Powershell module from $scvmmModulePath" -verbose
    
    $module = LoadSCVMMPowershellModule $scvmmModulePath
    
    if($module)
    {
        $psmodulesToLoad.Value += $module
    }
    
    $scvmmPlatform = GetSCVMMPlatform

    $powershellScriptsToLoad.Value += $scvmmPlatform

    Write-Verbose "Get SCVMM Endpoint details" -verbose

    $scvmmEndpoint = GetSCVMMEndpointData $connectedServiceName

    Write-Verbose "Get SCVMM connection credential" -verbose

    $scvmmCred.Value = GetSCVMMConnectionCredential -endpoint $scvmmEndpoint

    write-verbose "Retrieve SCVMM server details - name and port" -verbose

    $scvmmServerInfo.Value = GetSCVMMServerInfo -scvmmServer $scvmmEndpoint.Data['scvmmServer']

    Write-Verbose "Retrieve SCVMM VM list" -verbose

    $scvmmVMList.Value = GetSCVMMVMList -scvmmVMList $vmlist
    
    Write-Verbose "Pre-operations done " -Verbose
}

function Execute-Main
{
    Write-Verbose "Entering Execute-Main function" -Verbose
    
    DoPreOperations ([ref]$psmodulesToLoad) ([ref]$powershellScriptsToLoad) ([ref]$scvmmCred) ([ref]$scvmmServerInfo) ([ref]$scvmmVMList)   
    
    $vmFilteringScope = $null
    $scvmmFilteringScopeValue = $null
    
    if( ( $scopeFilter -eq $CloudFiltering ) -and ![string]::IsNullOrWhiteSpace($cloudFilter))
    {
        write-host "Action -$action will be performed on Vm(s)- $($scvmmVMList) present in cloud - $cloudFilter"
        $vmFilteringScope = $CloudFiltering
        $scvmmFilteringScopeValue = $cloudFilter
    }
    elseif( ( $scopeFilter -eq $HostFiltering ) -and ![string]::IsNullOrWhiteSpace($hostFilter) )
    {
        write-host "Action -$action will be performed on Vm(s) - $($scvmmVMList) present in host - $hostFilter"
        $vmFilteringScope = $HostFiltering
        $scvmmFilteringScopeValue = $hostFilter        
    }
    
    [hashtable]$jobs = @{} 
    foreach($vm in $scvmmVMList)
    {
        Write-Host "  Executing $action on $vm"
        Switch ($action)
        {
            
            "Restore" {
                
                $job = Start-Job -ScriptBlock $RunSCVMMRestoreVMJob -ArgumentList $vm, $scvmmServerInfo.name, $scvmmServerInfo.port, $scvmmCred, $vmFilteringScope, $scvmmFilteringScopeValue, $checkPointName, $psmodulesToLoad, $powershellScriptsToLoad
                break
            }

            default {
                throw "No valid action provided for execution on $vm"
            }
            
        }
        $jobs.Add($job.Id, $vm)
        
    }
    
    $operationStatus = "Passed"
    [string]$errorMessage =''
    While (Microsoft.PowerShell.Core\Get-Job | where-object { $jobs.Keys -contains $_.Id } )
    {
        write-Host " Please wait $action action is in progress "
        Start-Sleep 10
        
        foreach($job in ( Microsoft.PowerShell.Core\Get-Job | where-object { $jobs.Keys -contains $_.Id } ) )
        {
            if($job.State -ne "Running")
            {
                
                $output = Receive-Job -Id $job.Id
                Remove-Job $job
                $status = $output.Status
                $vmName = $jobs.Item($job.Id)
                
                if($status -ne "Passed")
                {
                    $operationStatus = "Failed"                   
                    $errorMessage += $output.ErrorMessage + ". `n"

                    Write-Host "##[error] $($output.Action) action failed on VM - $($output.VMName). Error -  $($output.ErrorMessage) `n $($output.Exception)"  
                    
                }elseif($status -eq "Passed")
                {
                    Write-Host "##[command] $($output.Message)"                   
                }
            }
        }
    }
    
    if($operationStatus -ne "Passed")
    {
        write-error "$action action failed !!! `n $errorMessage"
    }
    
    Write-Verbose "Exiting Execute-Main function" -Verbose
}


if([string]::IsNullOrWhiteSpace($connectedServiceName))
{
    throw "Service connection name should not be null or empty."
}

if([string]::IsNullOrWhiteSpace($vmlist))
{
    throw "Machine / Machine list on which action to be performed can't be null or empty"
}

if([string]::IsNullOrWhiteSpace($action))
{
    throw "Action to be perfomed  can't be null or empty"
}

if($action -eq $RestoreAction -and [string]::IsNullOrWhiteSpace($checkPointName))
{
    throw "For $action, checkpoint can't be empty or null"
}

Invoke-Expression $MethodToInvoke
