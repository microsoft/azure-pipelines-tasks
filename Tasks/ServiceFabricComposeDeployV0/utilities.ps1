function Get-SinglePathOfType
{
    Param (
        [String]
        $Pattern,

        [ValidateSet("Leaf", "Container")]
        $PathType,

        [Switch]
        $Require
    )

    Write-Host (Get-VstsLocString -Key SearchingForPath -ArgumentList $Pattern)
    if ($Pattern)
    {
        if ($PathType -eq "Container")
        {
            $path = Find-VstsFiles -LegacyPattern $Pattern -IncludeDirectories
        }
        else
        {
            $path = Find-VstsFiles -LegacyPattern $Pattern
        }
    }
    else
    {
        $path = $null
    }

    if (@($path).Length -gt 1)
    {
        throw (Get-VstsLocString -Key ItemSearchMoreThanOneFound -ArgumentList $Pattern)
    }
    elseif ($path -eq $null -or @($path).Length -eq 0)
    {
        $noFileFoundMessage = Get-VstsLocString -Key ItemSearchNoFilesFound -ArgumentList $Pattern
        if ($Require)
        {
            throw $noFileFoundMessage
        }
        else
        {
            Write-Host $noFileFoundMessage
        }
    }
    else
    {
        Assert-VstsPath -LiteralPath $path -PathType $PathType
        Write-Host (Get-VstsLocString -Key FoundPath -ArgumentList $path)
    }

    return $path
}

function Get-ServiceFabricComposeApplicationStatusHelper
{
    Param (
        [Parameter(Mandatory = $True)]
        [string]
        $ApiVersion,

        [Parameter(Mandatory = $True)]
        [HashTable]
        $GetStatusParameters
    )

    $global:operationId = $SF_Operations.GetComposeDeploymentStatus
    switch ($ApiVersion)
    {
        "255.255"
        {
            $status = Get-ServiceFabricComposeApplicationStatusPaged @GetStatusParameters
            if ($status)
            {
                return @{
                    "Status"        = $status.ComposeApplicationStatus
                    "StatusDetails" = $status.StatusDetails
                }
            }
            else
            {
                return $null
            }
        }
        "2.7"
        {
            $status = Get-ServiceFabricComposeApplicationStatus @GetStatusParameters
            if ($status)
            {
                return @{
                    "Status"        = $status.ComposeApplicationStatus
                    "StatusDetails" = $status.StatusDetails
                }
            }
            else
            {
                return $null
            }
        }
        Default
        {
            $status = Get-ServiceFabricComposeDeploymentStatus @GetStatusParameters
            if ($status)
            {
                return @{
                    "Status"        = $status.ComposeDeploymentStatus
                    "StatusDetails" = $status.StatusDetails
                }
            }
            else
            {
                return $null
            }
        }
    }
}

function Remove-ServiceFabricComposeApplicationHelper
{
    Param (
        [Parameter(Mandatory = $True)]
        [string]
        $ApiVersion,

        [Parameter(Mandatory = $True)]
        [HashTable]
        $RemoveParameters
    )

    $global:operationId = $SF_Operations.RemoveComposeDeployment

    switch ($ApiVersion)
    {
        "255.255"
        {
            return Remove-ServiceFabricComposeApplication @RemoveParameters
        }
        "2.7"
        {
            return Remove-ServiceFabricComposeApplication @RemoveParameters
        }
        Default
        {
            return Remove-ServiceFabricComposeDeployment @RemoveParameters
        }
    }
}

function New-ServiceFabricComposeApplicationHelper
{
    Param (
        [Parameter(Mandatory = $True)]
        [string]
        $ApiVersion,

        [Parameter(Mandatory = $True)]
        [HashTable]
        $DeployParameters
    )

    $global:operationId = $SF_Operations.CreateNewComposeDeployment

    switch ($ApiVersion)
    {
        "255.255"
        {
            return New-ServiceFabricComposeApplication @DeployParameters
        }
        "2.7"
        {
            return New-ServiceFabricComposeApplication @DeployParameters
        }
        Default
        {
            return New-ServiceFabricComposeDeployment @DeployParameters
        }
    }
}

function Start-ServiceFabricComposeDeploymentUpgradeHelper
{
    Param (
        [Parameter(Mandatory = $True)]
        [string]
        $ApiVersion,

        [Parameter(Mandatory = $True)]
        [HashTable]
        $UpgradeParameters
    )

    $global:operationId = $SF_Operations.StartComposeDeploymentUpgrade
    Start-ServiceFabricComposeDeploymentUpgrade @UpgradeParameters
}

function Get-ServiceFabricComposeDeploymentUpgradeHelper
{
    Param (
        [Parameter(Mandatory = $True)]
        [string]
        $ApiVersion,

        [Parameter(Mandatory = $True)]
        [HashTable]
        $GetUpgradeParameters
    )

    $global:operationId = $SF_Operations.GetComposeDeploymentUpgradeStatus
    $composeDeploymentUpgrade = Get-ServiceFabricComposeDeploymentUpgrade @GetUpgradeParameters

    if ($composeDeploymentUpgrade -eq $null)
    {
        return $null
    }

    # Currently there is a bug in Get-ServiceFabricComposeDeploymentUpgrade so that it returns the wrong upgrade status when rolling back, need to get that information from Get-ServiceFabricApplicationUpgrade instead
    $appUpgradeParameters = @{
        "ApplicationName" = $composeDeploymentUpgrade.ApplicationName
    }
    if ($GetUpgradeParameters['TimeoutSec'])
    {
        $appUpgradeParameters['TimeoutSec'] = $GetUpgradeParameters['TimeoutSec']
    }
    $appUpgrade = Get-ServiceFabricApplicationUpgrade @appUpgradeParameters

    if ($appUpgrade -eq $null)
    {
        return $composeDeploymentUpgrade
    }

    return @{
        "UpgradeState"         = $appUpgrade.UpgradeState
        "UpgradeStatusDetails" = $composeDeploymentUpgrade.UpgradeStatusDetails
    }
}

function IsUpgradeRunning
{
    Param (
        [Parameter(Mandatory = $True)]
        [string]
        $UpgradeState
    )

    return ($UpgradeState -ne 'Failed' -and `
            $UpgradeState -ne 'Invalid' -and `
            $UpgradeState -ne 'RollingForwardCompleted' -and `
            $UpgradeState -ne 'RollingBackCompleted')
}

function Test-ApplicationName
{
    Param (
        [Parameter(Mandatory = $True)]
        [string]
        $ApiVersion,

        [Parameter(Mandatory = $True)]
        [string]
        $ApplicationName
    )

    switch ($ApiVersion)
    {
        "255.255"
        {
            return
        }
        "2.7"
        {
            return
        }
        Default
        {
            if ($ApplicationName.StartsWith("fabric:/", [StringComparison]::OrdinalIgnoreCase))
            {
                Write-Warning (Get-VstsLocString -Key InvalidApplicationNameWarning -ArgumentList $ApplicationName)
            }

            return
        }
    }
}