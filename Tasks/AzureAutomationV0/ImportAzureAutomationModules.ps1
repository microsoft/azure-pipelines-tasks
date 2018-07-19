param (
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName,
    [string][Parameter(Mandatory=$true)]$ResourceGroupName,
    [string][Parameter(Mandatory=$true)]$AutomationAccountName,
    [string][Parameter(Mandatory=$true)]$ModulePath,
    [string][Parameter(Mandatory=$true)]$StorageAccountName
)

$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

# Get all modules inside the provided moduels folder
[psmoduleinfo[]]$Modules = Get-Module -ListAvailable "$ModulePath\*"

# Create temporary folders in which to copy compressed modules into
$DestinationFolder = Join-Path $Env:Temp (New-Guid).Guid
$DownloadedModulesPath = Join-Path $DestinationFolder DownloadedModules
$CompressedModulesPath = Join-Path $DestinationFolder CompressedModules
$TempNameChangeFolder = Join-Path $DestinationFolder TempFolder

if (Test-Path $DestinationFolder) {
    Remove-Item $DestinationFolder -Force -Recurse -ea stop
}

$null = New-Item -Path $DownloadedModulesPath -ItemType Directory -Force
$null = New-Item -Path $CompressedModulesPath -ItemType Directory -Force 
$null = New-Item -Path $TempNameChangeFolder -ItemType Directory -Force 
 
foreach ($Module in $Modules)
{
    # Copy each module into tempnamechange folder and rename module folders to follow Automation module structure
    $ModuleName = $Module.Name
    Copy-Item -Path "$($ModulePath)\$($ModuleName)" -Destination $TempNameChangeFolder -Recurse
    if (Test-Path -Path "$TempNameChangeFolder\$($ModuleName)\$($ModuleVersion)\") 
    {
        Get-ChildItem -Path "$TempNameChangeFolder\$($ModuleName)" -Directory -Recurse -Depth 1 | Rename-Item -NewName $ModuleName
    }
}

# Get all modules currently in the Automation Account 
$ModulesMetadata = Get-AzureRmAutomationModule -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName
$ExistingModules = @{}

# Create a hashmap of existing modules, mapping module version to module name
foreach ($Metadata in $ModulesMetadata)
{
    $ExistingModules.Add($Metadata.Name, $Metadata.Version)
}

foreach ($Module in $Modules)
{
    $ModuleName = $Module.Name
    $ModuleVersion = $Module.Version

    <# If the name and version of the module in temp folder matches a module already in the 
            Automation Account, skip past it and don't compress it #>
    if ($ExistingModules.ContainsKey($ModuleName)) 
    {
        if ($ExistingModules.Get_Item($ModuleName) -eq $ModuleVersion) 
        {
            continue
        }
    }

    Write-Host "Compressing module: $ModuleName"

    # Compress module to a zip file and store it in the compressed folder
    if (-not (Test-Path -Path "$CompressedModulesPath\$($ModuleName).zip"))
    {
        if (Test-Path "$TempNameChangeFolder\$($ModuleName)\$($ModuleName)")
        {
            Compress-Archive -Path "$TempNameChangeFolder\$($ModuleName)\$($ModuleName)" -DestinationPath "$CompressedModulesPath\$($ModuleName).zip" -Force
        }
        elseif (Test-Path -Path "$TempNameChangeFolder\$($ModuleName)")
        {
            Compress-Archive -Path "$TempNameChangeFolder\$($ModuleName)" -DestinationPath "$CompressedModulesPath\$($ModuleName).zip" -Force
        }
    }
}

# Get the name of the Azure Storage Account and create a new container called 'modules' in it
$StorageAccount = Get-AzureRmStorageAccount -ResourceGroupName $ResourceGroupName -AccountName $StorageAccountName
New-AzureStorageContainer -Name 'modules' -Context $StorageAccount.Context
 
# Get all module zip files saved in compressed folder
$ModuleZips = Get-ChildItem -Path $CompressedModulesPath -Filter *.zip -File

 foreach ($ModuleZip in $ModuleZips)
 {
     # Save each module zip in a new blob inside the modules container
    $StorageLocation = Set-AzureStorageBlobContent -Container 'modules' -Context $StorageAccount.Context -Blob $ModuleZip.Name -File $ModuleZip.FullName -Force
    $Link = New-AzureStorageBlobSASToken -Container 'modules' -Blob $StorageLocation.Name -Context $StorageAccount.Context -FullUri `
            -Permission rwd -StartTime (Get-Date) -ExpiryTime (Get-Date).AddMinutes(60)

    Write-Host "Saved module $ModuleZip.Name to Storage Account container 'modules'... publishing to Azure Automation"

    # Use the blob SAS token to publish modules from Azure Storage to Automation Account
    $Module = New-AzureRmAutomationModule -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
            -Name $ModuleZip.BaseName -ContentLink $Link

    Write-Host "Module $ModuleZip.Name uploaded to Automation"

    # Wait until the current module is successfully imported before moving to next module
    While ((Get-AzureRmAutomationModule -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
            -Name $ModuleZip.BaseName).ProvisioningState -ne 'Succeeded')
    {
        Start-Sleep -Seconds 5
    }
 }

# Remove the temp folder where modules were temporarily stored 
Remove-Item $DestinationFolder -Recurse -Force -ea SilentlyContinue

    