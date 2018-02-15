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
        [Parameter(Mandatory=$True)]
        [string]
        $ApiVersion,

        [Parameter(Mandatory=$True)]
        [HashTable]
        $GetStatusParameters
    )

    switch ($ApiVersion) {
        "255.255" {
            $status = Get-ServiceFabricComposeApplicationStatusPaged @GetStatusParameters
            if ($status)
            {
                return @{
                    "Status" = $status.ComposeApplicationStatus
                    "StatusDetails" = $status.StatusDetails
                }
            }
            else
            {
                return $null
            }
        }
        "2.7" {
            $status = Get-ServiceFabricComposeApplicationStatus @GetStatusParameters
            if ($status)
            {
                return @{
                    "Status" = $status.ComposeApplicationStatus
                    "StatusDetails" = $status.StatusDetails
                }
            }
            else
            {
                return $null
            }
        }
        Default {
            $status = Get-ServiceFabricComposeDeploymentStatus @GetStatusParameters
            if ($status)
            {
                return @{
                    "Status" = $status.ComposeDeploymentStatus
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
        [Parameter(Mandatory=$True)]
        [string]
        $ApiVersion,

        [Parameter(Mandatory=$True)]
        [HashTable]
        $RemoveParameters
    )

    switch ($ApiVersion) {
        "255.255" {
            return Remove-ServiceFabricComposeApplication @RemoveParameters
        }
        "2.7" {
            return Remove-ServiceFabricComposeApplication @RemoveParameters
        }
        Default {
            return Remove-ServiceFabricComposeDeployment @RemoveParameters
        }
    }
}

function New-ServiceFabricComposeApplicationHelper
{
    Param (
        [Parameter(Mandatory=$True)]
        [string]
        $ApiVersion,

        [Parameter(Mandatory=$True)]
        [HashTable]
        $DeployParameters
    )

    switch ($ApiVersion) {
        "255.255" {
            return New-ServiceFabricComposeApplication @DeployParameters
        }
        "2.7" {
            return New-ServiceFabricComposeApplication @DeployParameters
        }
        Default {
            return New-ServiceFabricComposeDeployment @DeployParameters
        }
    }
}
