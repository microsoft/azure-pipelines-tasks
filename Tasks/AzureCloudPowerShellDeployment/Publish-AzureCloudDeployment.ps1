[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $ConnectedServiceName,

    [String] [Parameter(Mandatory = $true)]
    $ServiceName,

    [String] [Parameter(Mandatory = $true)]
    $ServiceLocation,

    [String] [Parameter(Mandatory = $true)]
    $StorageAccount,

    [String] [Parameter(Mandatory = $true)]
    $CsPkg,  #of the form **\*.cspkg (or a path right to a cspkg file, if possible)

    [String] [Parameter(Mandatory = $true)]
    $CsCfg,  #of the form **\*.cscfg (or a path right to a cscfg file, if possible)

    [String] [Parameter(Mandatory = $true)]  #default to Production
    $Slot,

    [String] [Parameter(Mandatory = $true)]
    $AllowUpgrade
)

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

function Get-SingleFile($files, $pattern)
{
    if ($files -is [system.array])
    {
        throw (Get-LocalizedString -Key "Found more than one file to deploy with search pattern {0}. There can be only one." -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            throw (Get-LocalizedString -Key "No files were found to deploy with search pattern {0}" -ArgumentList $pattern)
        }
        return $files
    }
}

#Filename= DiagnosticsExtension.WebRole1.PubConfig.xml returns WebRole1
#Filename= DiagnosticsExtension.Web.Role1.PubConfig.xml returns Web.Role1
#Role names can have dots in them
function Get-RoleName($extPath)
{
    $roleName = ""

    #The following statement uses the SimpleMatch option to direct the -split operator to interpret the dot (.) delimiter literally.
    #With the default, RegexMatch, the dot enclosed in quotation marks (".") is interpreted to match any character except for a newline
    #character. As a result, the Split statement returns a blank line for every character except newline.  The 0 represents the "return
    #all" value of the Max-substrings parameter. You can use options, such as SimpleMatch, only when the Max-substrings value is specified.
    $roles = $extPath -split ".",0,"simplematch"

    if ($roles -is [system.array] -and $roles.Length -gt 1)
    {
        $roleName = $roles[1] #base role name

        $x = 2
        while ($x -le $roles.Length)
        {
            if ($roles[$x] -ne "PubConfig")
            {
                $roleName = $roleName + "." + $roles[$x]
            }
            else
            {
                break
            }
            $x++
        }
    }
    else
    {
        Write-Warning (Get-LocalizedString -Key "'{0}' could not be parsed into parts for registering diagnostics extensions." -ArgumentList $extPath)
    }

    return $roleName
}

function Get-DiagnosticsExtensions($storageAccount, $extensionsPath)
{
    $diagnosticsConfigurations = @()
    
    $extensionsSearchPath = Split-Path -Parent $extensionsPath
    Write-Verbose "extensionsSearchPath= $extensionsSearchPath"
    $extensionsSearchPath = Join-Path -Path $extensionsSearchPath -ChildPath "Extensions"
    Write-Verbose "extensionsSearchPath= $extensionsSearchPath"
    #$extensionsSearchPath like C:\Agent\_work\bd5f89a2\staging\Extensions
    if (!(Test-Path $extensionsSearchPath))
    {
        Write-Verbose "No Azure Cloud Extensions found at '$extensionsSearchPath'"
    }
    else
    {
        Write-Host (Get-LocalizedString -Key "Applying any configured diagnostics extensions.")

        Write-Verbose "Getting the primary AzureStorageKey..."
        $primaryStorageKey = (Get-AzureStorageKey -StorageAccountName "$storageAccount").Primary

        if ($primaryStorageKey)
        {
            Write-Verbose "New-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey <key>"
            $definitionStorageContext = New-AzureStorageContext -StorageAccountName $storageAccount -StorageAccountKey $primaryStorageKey

            Write-Verbose "Get-ChildItem -Path $extensionsSearchPath -Filter PaaSDiagnostics.*.PubConfig.xml"
            $diagnosticsExtensions = Get-ChildItem -Path $extensionsSearchPath -Filter "PaaSDiagnostics.*.PubConfig.xml"

            #$extPath like PaaSDiagnostics.WebRole1.PubConfig.xml
            foreach ($extPath in $diagnosticsExtensions)
            {
                $role = Get-RoleName $extPath
                if ($role)
                {
                    $fullExtPath = Join-Path -path $extensionsSearchPath -ChildPath $extPath
                    Write-Verbose "fullExtPath= $fullExtPath"

                    Write-Verbose "Loading $fullExtPath as XML..."
                    $publicConfig = New-Object XML
                    $publicConfig.Load($fullExtPath)
                    if ($publicConfig.PublicConfig.StorageAccount)
                    {
                        #We found a StorageAccount in the role's diagnostics configuration.  Use it.
                        $publicConfigStorageAccountName = $publicConfig.PublicConfig.StorageAccount
                        Write-Verbose "Found PublicConfig.StorageAccount= '$publicConfigStorageAccountName'"

                        $publicConfigStorageKey = Get-AzureStorageKey -StorageAccountName $publicConfigStorageAccountName
                        if ($publicConfigStorageKey)
                        {
                            Write-Verbose "New-AzureStorageContext -StorageAccountName $publicConfigStorageAccountName -StorageAccountKey <key>"
                            $storageContext = New-AzureStorageContext -StorageAccountName $publicConfigStorageAccountName -StorageAccountKey $publicConfigStorageKey.Primary
                        }
                        else
                        {
                            Write-Warning (Get-LocalizedString -Key "Could not get the primary storage key for the public config storage account '{0}'.  Unable to apply any diagnostics extensions." -ArgumentList $publicConfigStorageAccountName)
                            return
                        }
                    }
                    else
                    {
                        #If we don't find a StorageAccount in the XML file, use the one associated with the definition's storage account
                        Write-Verbose "No StorageAccount found in PublicConfig.  Using the storage account set on the definition..."
                        $storageContext = $definitionStorageContext
                    }

                    Write-Host "New-AzureServiceDiagnosticsExtensionConfig -Role $role -StorageContext <context> -DiagnosticsConfigurationPath $fullExtPath"
                    $wadconfig = New-AzureServiceDiagnosticsExtensionConfig -Role $role -StorageContext $storageContext -DiagnosticsConfigurationPath $fullExtPath 

                    #Add each extension configuration to the array for use by caller
                    $diagnosticsConfigurations += $wadconfig
                }
            }
        }
        else
        {
            Write-Warning (Get-LocalizedString -Key "Could not get the primary storage key for storage account '{0}'.  Unable to apply any diagnostics extensions." -ArgumentList $storageAccount)
        }
    }
    
    return $diagnosticsConfigurations
}

Write-Verbose "Entering script Publish-AzureCloudDeployment.ps1"

Write-Verbose "ConnectedServiceName= $ConnectedServiceName "
Write-Verbose "ServiceName= $ServiceName"
Write-Verbose "ServiceLocation= $ServiceLocation"
Write-Verbose "StorageAccount= $StorageAccount"
Write-Verbose "CsPkg= $CsPkg"
Write-Verbose "CsCfg= $CsCfg"
Write-Verbose "Slot= $Slot"
Write-Verbose "AllowUpgrade= $AllowUpgrade"

$allowUpgrade = Convert-String $AllowUpgrade Boolean

Write-Verbose "Find-Files -SearchPattern $CsCfg"
$serviceConfigFile = Find-Files -SearchPattern "$CsCfg"
Write-Verbose "serviceConfigFile= $serviceConfigFile" -ForegroundColor Yellow
$serviceConfigFile = Get-SingleFile $serviceConfigFile $CsCfg

Write-Verbose "Find-Files -SearchPattern $CsPkg"
$servicePackageFile = Find-Files -SearchPattern "$CsPkg"
Write-Verbose "servicePackageFile= $servicePackageFile" -ForegroundColor Yellow
$servicePackageFile = Get-SingleFile $servicePackageFile $CsPkg

Write-Host "Get-AzureService -ServiceName $ServiceName -ErrorAction SilentlyContinue"
$azureService = Get-AzureService -ServiceName $ServiceName -ErrorAction SilentlyContinue
if (!$azureService)
{
    Write-Host "New-AzureService -ServiceName $ServiceName -Location $ServiceLocation"
    $azureService = New-AzureService -ServiceName $ServiceName -Location $ServiceLocation
}

$diagnosticExtensions = Get-DiagnosticsExtensions $StorageAccount $CsCfg

Write-Host "Get-AzureDeployment -ServiceName $ServiceName -Slot $Slot -ErrorAction SilentlyContinue"
$azureDeployment = Get-AzureDeployment -ServiceName $ServiceName -Slot $Slot -ErrorAction SilentlyContinue
if (!$azureDeployment)
{
    Write-Host "New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration <extensions>"
    $azureDeployment = New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration $diagnosticExtensions
} 
elseif ($allowUpgrade -eq $true)
{
    #Use -Upgrade
    Write-Host "Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration <extensions>"
    $azureDeployment = Set-AzureDeployment -Upgrade -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration $diagnosticExtensions
}
else
{
    #Remove and then Re-create
    Write-Host "Remove-AzureDeployment -ServiceName $ServiceName -Slot $Slot -Force"
    $azureOperationContext = Remove-AzureDeployment -ServiceName $ServiceName -Slot $Slot -Force
    Write-Host "New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration <extensions>"
    $azureDeployment = New-AzureDeployment -ServiceName $ServiceName -Package $servicePackageFile -Configuration $serviceConfigFile -Slot $Slot -ExtensionConfiguration $diagnosticExtensions
}


Write-Verbose "Leaving script Publish-AzureCloudDeployment.ps1"
