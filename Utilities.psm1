<#function RemoveAllServiceFabricApplications
{
	$nodesList = Get-ServiceFabricNode
	foreach($currentNode in $nodesList){
		$nodeName = $currentNode.NodeName
		$applicationsList = Get-ServiceFabricDeployedApplication -NodeName $nodeName
		foreach($application in $applicationsList){
			$applicationName = $application.ApplicationName.OriginalString
			$applicationTypeName = $application.ApplicationTypeName
			#$applicationVersion = (Get-ServiceFabricApplication -ApplicationName $applicationName).ApplicationTypeVersion

			$applicationObj = Get-ServiceFabricApplication -ApplicationName $applicationName
			if($applicationObj) {
				$applicationVersion = $applicationObj.ApplicationTypeVersion
	            Write-Host -ForegroundColor red "removing applicationname: $applicationName applicationTypeName: $applicationTypeName applicationTypeVersion:$applicationVersion nodeName: $nodeName"
				Remove-ServiceFabricApplication -ApplicationName $applicationName -Force
				Unregister-ServiceFabricApplicationType -ApplicationTypeName  $applicationTypeName -ApplicationTypeVersion $applicationVersion -Force
			}
		}
	}
}#>

function Copy-Temp
{
    <#
    .SYNOPSIS 
    Copies files to a temp folder.

    .PARAMETER From
    Source location from which to copy files.

    .PARAMETER Name
    Folder name within temp location to store the files.
    #>

    [CmdletBinding()]
    Param
    (
        [String]
        $From,
        
        [String]
        $Name
    )

    if (!(Test-Path $From))
    {
        return $null
    }

    $To = $env:Temp + '\' + $Name
    
    if (Test-Path $To)
    {
        Remove-Item -Path $To -Recurse -ErrorAction Stop | Out-Null
    }

    New-Item $To -ItemType directory | Out-Null

    robocopy "$From" "$To" /E | Out-Null

    # robocopy has non-standard exit values that are documented here: https://support.microsoft.com/en-us/kb/954404
    # Exit codes 0-8 are considered success, while all other exit codes indicate at least one failure.
    # Some build systems treat all non-0 return values as failures, so we massage the exit code into
    # something that they can understand.
    if (($LASTEXITCODE -ge 0) -and ($LASTEXITCODE -le 8))
    {
        # Simply setting $LASTEXITCODE in this script will not override the script's exit code.
        # We need to start a new process and let it exit.
        PowerShell -NoProfile -Command "exit 0"
    }

    return $env:Temp + '\' + $Name
}

function Get-Names
{
    <#
    .SYNOPSIS 
    Returns an object containing common information from the application manifest.

    .PARAMETER ApplicationManifestPath
    Path to the application manifest file.
    
	.PARAMETER PublishProfile
    Hashtable containing the publish profile settings.
	#>

    [CmdletBinding()]
    Param
    (
        [String]
        $ApplicationManifestPath
    )

    $appXml = [xml] (Get-Content $ApplicationManifestPath)
    if (!$appXml)
    {
        return
    }

    $appMan = $appXml.ApplicationManifest
    $FabricNamespace = 'fabric:'
    $appTypeSuffix = 'Type'

    $h = @{
        FabricNamespace = $FabricNamespace;
        ApplicationTypeName = $appMan.ApplicationTypeName;
        ApplicationTypeVersion = $appMan.ApplicationTypeVersion;
    }

    $shortAppName = $appMan.ApplicationTypeName
    if ($shortAppName.EndsWith($appTypeSuffix))
    {
        $shortAppName = $shortAppName.Substring(0, $shortAppName.Length - $appTypeSuffix.Length)
    }

	$appName = $FabricNamespace + "/" + $shortAppName

    $h += @{
        ApplicationName = $appName
    }

    Write-Output (New-Object psobject -Property $h)
}

function Get-ImageStoreConnectionString
{
    <#
    .SYNOPSIS 
    Returns the value of the image store connection string from the cluster manifest.

    .PARAMETER ApplicationManifestPath
    Path to the application manifest file.
    #>

    [CmdletBinding()]
    Param
    (
        [xml]
        $ClusterManifest
    )

    $managementSection = $ClusterManifest.ClusterManifest.FabricSettings.Section | ? { $_.Name -eq "Management" }
    return $managementSection.ChildNodes | ? { $_.Name -eq "ImageStoreConnectionString" } | Select-Object -Expand Value
}

function Read-PublishProfile
{
    <#
    .SYNOPSIS 
    Parses the publish profile file and returns a Hashtable containing its state.

    .PARAMETER PublishProfileFilePath
    Path to the publish profile file.
    #>

    [CmdletBinding()]
    Param
    (
        [String]
        $PublishProfileFilePath
    )

    if (!(Test-Path $PublishProfileFilePath))
    {
        throw "$PublishProfileFilePath is not found."
    }

    $PublishProfileFolder = (Split-Path $PublishProfileFilePath)

    $PublishProfile = ([xml] (Get-Content $PublishProfileFilePath)).PublishProfile
	$PublishProfile = Convert-PublishProfileToHashtable $PublishProfile

    return $PublishProfile;
}


function Convert-PublishProfileToHashtable
{
    <#
    .SYNOPSIS 
    Converts publish profile XML file to a Hashtable.

    .PARAMETER xml
    The XML to convert.
    #>

    [CmdletBinding()]
    Param
    (
        [System.Xml.XmlElement]
        $xml
    )

    $hash = @{}
    $xml.ChildNodes | foreach {
        if ($_.Name -eq 'ClusterConnectionParameters') {
            $parameters = @{}
            $_.Attributes | foreach {
                $boolVal = $null
                if ([bool]::TryParse($_.Value, [ref]$boolVal)) {
                    $parameters[$_.Name] = $boolVal
                }
                else {
                    $parameters[$_.Name] = $_.Value
                }
            }

            $hash[$_.Name] = $parameters
        }
        else {
            $hash[$_.Name] = $_.'#text'
        }
    }

    return $hash
}
