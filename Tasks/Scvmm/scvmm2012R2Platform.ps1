function RestoreCheckPoint
{   
    param(   
    [Parameter(Mandatory=$true)]
    [object]$checkPoint
    )
    
    $restoreResult = Restore-SCVMCheckpoint -VMCheckpoint $checkPoint  
    write-Output $restoreResult
}

function GetCloud
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$cloudName,
    [Parameter(Mandatory=$true)]
    [object]$scvmmServerConnection
    )
    
    $cloud = Get-SCCloud -Name $cloudName -VMMServer $scvmmServerConnection
    write-Output $cloud
}

function GetHost
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$hostName,
    [Parameter(Mandatory=$true)]
    [object]$scvmmServerConnection
    )
    
    $scvmHost = $null
    $scvmHost = Get-SCVMHost -ComputerName $hostName -VMMServer $scvmmServerConnection

    write-Output $scvmHost
}

function GetVMWithinCloud
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$vmName,
    [Parameter(Mandatory=$true)]
    [object]$scvmmServerConnection,
    [Parameter(Mandatory=$true)]
    [object]$cloud
    )
    
    $vm = Get-SCVirtualMachine -Name $vmName -Cloud $cloud -VMMServer $scvmmServerConnection
    write-Output $vm
}

function GetVMWithinHost
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$vmName,
    [Parameter(Mandatory=$true)]
    [object]$scvmmServerConnection,   
    [Parameter(Mandatory=$true)]
    [object]$vmHost
    )
    
    $vm =  Get-SCVirtualMachine -Name $vmName -VMHost $vmHost -VMMServer $scvmmServerConnection
    write-Output $vm
}

function GetVM
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$vmName,
    [Parameter(Mandatory=$true)]
    [object]$scvmmServerConnection
    )
    
    $vm = Get-SCVirtualMachine -Name $vmName -VMMServer $scvmmServerConnection 
    write-Output $vm
}

function GetSCVMMServerConnection
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$scvmmServerName,
    [Parameter(Mandatory=$true)]
    [PSCredential]$scvmmCredential,
    [Parameter(Mandatory=$true)]
    [string]$scvmmServerPort
    )

    $connection = Get-SCVMMServer -ComputerName $scvmmServerName -Credential $scvmmCredential -TCPPort $scvmmServerPort
    Write-Output $connection
}

function GetCheckPoint
{
    param(
    [Parameter(Mandatory=$true)]
    [object]$scvmmVM,
    [Parameter(Mandatory=$true)]
    [object]$scvmmServerConnection,
    [Parameter(Mandatory=$true)]
    [string]$checkPointName
    )

    $checkPoint = Get-SCVMCheckpoint -VM $scvmmVM -VMMServer $scvmmServerConnection | Where-Object { $_.Name -eq $checkPointName }
    Write-Output $checkPoint
}
