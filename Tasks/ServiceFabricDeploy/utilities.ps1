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

function Read-XmlElementAsHashtable
{
    Param (
        [System.Xml.XmlElement]
        $Element
    )

    $hashtable = @{}
    if ($Element.Attributes)
    {
        $Element.Attributes | 
            ForEach-Object {
                # Only boolean values are strongly-typed.  All other values are treated as strings.
                $boolVal = $null
                if ([bool]::TryParse($_.Value, [ref]$boolVal)) {
                    $hashtable[$_.Name] = $boolVal
                }
                else {
                    $hashtable[$_.Name] = $_.Value
                }
            }
    }

    return $hashtable
}

function Read-PublishProfile
{
    Param (
        [String]
        $PublishProfileFile
    )

    $publishProfileXml = [Xml] (Get-Content -LiteralPath $PublishProfileFile)
    $publishProfileElement = $publishProfileXml.PublishProfile
    $publishProfile = @{}

    $publishProfile.UpgradeDeployment = Read-XmlElementAsHashtable $publishProfileElement.Item("UpgradeDeployment")
    $publishProfile.CopyPackageParameters = Read-XmlElementAsHashtable $publishProfileElement.Item("CopyPackageParameters")

    if ($publishProfileElement.Item("UpgradeDeployment"))
    {
        $publishProfile.UpgradeDeployment.Parameters = Read-XmlElementAsHashtable $publishProfileElement.Item("UpgradeDeployment").Item("Parameters")
        if ($publishProfile.UpgradeDeployment["Mode"])
        {
            $publishProfile.UpgradeDeployment.Parameters[$publishProfile.UpgradeDeployment["Mode"]] = $true
        }
    }
    
    $publishProfileFolder = (Split-Path $PublishProfileFile)
    $publishProfile.ApplicationParameterFile = [System.IO.Path]::Combine($publishProfileFolder, $publishProfileElement.ApplicationParameterFile.Path)

    return $publishProfile
}

function Get-VstsUpgradeParameters
{
    Param ()

    $parameters = @{}

    $parameterNames = @(
        "UpgradeReplicaSetCheckTimeoutSec",
        "ReplicaQuorumTimeoutSec",
        "TimeoutSec",
        "ForceRestart"
    )

    $upgradeMode = Get-VstsInput -Name upgradeMode -Require

    $parameters[$upgradeMode] = $true

    if ($upgradeMode -eq "Monitored")
    {
        $parameterNames += @(
            "FailureAction",
            "HealthCheckRetryTimeoutSec",
            "HealthCheckWaitDurationSec",
            "HealthCheckStableDurationSec",
            "UpgradeDomainTimeoutSec",
            "ConsiderWarningAsError",
            "DefaultServiceTypeHealthPolicy",
            "MaxPercentUnhealthyDeployedApplications",
            "UpgradeTimeoutSec",
            "ServiceTypeHealthPolicyMap"
        )
    }

    foreach ($name in $parameterNames)
    {
        $value = Get-VstsInput -Name $name
        if ($value)
        {
            if ($value -eq "false")
            {
                $parameters[$name] = $false
            }
            elseif ($value -eq "true")
            {
                $parameters[$name] = $true
            }
            else
            {
                $parameters[$name] = $value
            }
        }
    }

    $parameters["Force"] = $true

    return $parameters
}

function Copy-DiffPackage
{
	param (
		[array] $clusterPackages,
		[array] $localPackages,
		[string] $localParentPkgPath,
		[string] $diffParentPkgPath
	)

	$clusterPackagesByName = @{}

	foreach ($clusterPackage in $clusterPackages)
	{
		$clusterPackagesByName[$clusterPackage.Name] = $clusterPackage
	}

	$isCopied = $False
	foreach ($localPackage in $localPackages)
	{
		$clusterPackage = $clusterPackagesByName[$localPackage.Name]

		# If cluster package exists and the version is the same to the local package version, do not add the local package to Diff Package
		if ($clusterPackage.Version -eq $localPackage.Version)
		{
			continue
		}

		Write-Host "clusterPackage" $clusterPackage.OuterXml
		Write-Host "localPackage" $localPackage.OuterXml

		$localPkgPath = Join-Path $localParentPkgPath $localPackage.Name
		$diffPkgPath = Join-Path $diffParentPkgPath $localPackage.Name
		Write-Host "Copying" $localPkgPath "to" $diffPkgPath
		Write-Host (Get-VstsLocString -Key DIFFPKG_CopyingToDiffPackge -ArgumentList @($localPkgPath, $diffPkgPath))
		# Copy the package on this level to diff package which is considered to be Leaf
		Copy-Item $localPkgPath $diffPkgPath -Recurse
		$isCopied = $True
	}
	return $isCopied
}
