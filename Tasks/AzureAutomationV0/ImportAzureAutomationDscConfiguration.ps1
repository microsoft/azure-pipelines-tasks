param (
    [string][Parameter(Mandatory=$true)]$ConnectedServiceName,
    [string][Parameter(Mandatory=$true)]$ResourceGroupName,
    [string][Parameter(Mandatory=$true)]$AutomationAccountName,
    [string][Parameter(Mandatory=$true)]$DscConfigurationPath,
    [string][Parameter(Mandatory=$False)]$StorageAccountName
)

$ErrorActionPreference = "Stop"
$VerbosePreference = "Continue"

# Create temporary folders in which to copy compressed modules into 
$DestinationFolder = Join-Path $Env:Temp (New-Guid).Guid
$DownloadedModulesPath = Join-Path $DestinationFolder DownloadedModules
$CompressedModulesPath = Join-Path $DestinationFolder CompressedModules

if (Test-Path $DestinationFolder) 
{
    Remove-Item $DestinationFolder -Force -Recurse -ea stop
}

$null = New-Item -Path $DownloadedModulesPath -ItemType Directory -Force
$null = New-Item -Path $CompressedModulesPath -ItemType Directory -Force

# Get all configurations in the file path specified
$Configurations = Get-ChildItem -Path $DscConfigurationPath -File -Include ('*.ps1') -Recurse -Depth 1 | Select-String -Pattern '^Configuration' | Select-Object Path | Get-Item

# Import each configuration into the Automation Account 
foreach ($Configuration in $Configurations) 
{
    $DscConfiguration = Import-AzureRmAutomationDscConfiguration -SourcePath $DscConfigurationPath `
                            -AutomationAccountName $AutomationAccountName -ResourceGroupName $ResourceGroupName -Verbose -Published -Force    
}

Write-Host "Successfully imported configuration to Automation Account"

# If a Storage Account is specified, import DSC resources into Automation Account
if ($StorageAccountName)
{
    # Get all modules that are already in the Automation Account
    $ModulesMetadata = Get-AzureRmAutomationModule -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName
    $ExistingModules = @{}

    # Create a hashmap of existing modules, mapping module version to module name
    foreach ($Metadata in $ModulesMetadata) 
    {
        $ExistingModules.Add($Metadata.Name, $Metadata.Version)
    }

    # Parse each configuration provided to create ASTs
    foreach ($Configuration in $Configurations)
    {
        $ConfigFile = Resolve-Path $Configuration
        $dscAst = [System.Management.Automation.Language.Parser]::ParseFile($ConfigFile, [ref]$null, [ref]$null)
        $kwAsts = $dscAst.FindAll({
            param([System.Management.Automation.Language.Ast]$subAst)
            $subAst -is [System.Management.Automation.Language.DynamicKeywordStatementAst]}, $true)

        # Search the ASTs to find all occurences of the keyword 'Import-DscResource'
        $ImportDscResources = $kwAsts | Where-Object {$_.Extent.Text -like '*Import-DscResource*'}

        # Get all DSC Resources specified 
        foreach ($ImportDscResource in $ImportDscResources) 
        {
            # Get the name of the resource and save it to the downloads folder
            $ModuleName = $ImportDscResource.CommandElements.Where({$_.Value -ne 'Import-DscResource' -and $_.StaticType.Name -eq 'String' -and $_.Value -match '[a-z]+'})
            if (-not (Test-Path -Path "$DownloadedModulesPath\$($ModuleName.Value)\$($ModuleVersion.Value)"))
            {
                Save-Script -Name $ModuleName.Value -Path $DownloadedModulesPath
            }

            <# If the name and version of the module in downloads folder matches a module already in the
            Automation Account, skip past it and don't compress it #>
            $Version = (Get-ChildItem "$DownloadedModulesPath\$($ModuleName.Value)").Name
            if ($ExistingModules.ContainsKey($ModuleName.Value)) 
            {
                if ($ExistingModules.Get_Item($ModuleName) -eq $Version) 
                {
                    continue
                } 
            }

            <# If the same version of the module is not already in Automation, rename module folders to match 
            module structure required by Automation, then zip the module and save it to compressed folder #>
            Copy-Item $DownloadedModulesPath\$($ModuleName.Value)\$($Version) -Destination $DownloadedModulesPath -Recurse -Force
            Remove-Item $DownloadedModulesPath\$($ModuleName.Value) -Recurse -Force
            Rename-Item $DownloadedModulesPath\$($Version) -NewName $ModuleName.Value
            Compress-Archive -Path "$DownloadedModulesPath\$($ModuleName.Value)" -DestinationPath "$CompressedModulesPath\$($ModuleName.Value).zip"
        }
    }

    # Get the name of the Azure Storage Account and create a new container called 'dscmodules' in it
    $StorageAccount = Get-AzureRmStorageAccount -ResourceGroupName $ResourceGroupName -AccountName $StorageAccountName
    New-AzureStorageContainer -Name 'dscmodules' -Context $StorageAccount.Context
    
    # Get all module zip files saved in compressed folder
    $ModuleZips = Get-ChildItem -Path $CompressedModulesPath -Filter *.zip -File

    foreach ($ModuleZip in $ModuleZips) 
    {
        # Save each module zip in a new blob inside the dscmodules container
        $StorageLocation = Set-AzureStorageBlobContent -Container 'dscmodules' -Context $StorageAccount.Context -Blob $ModuleZip.Name -File $ModuleZip.FullName -Force
        $Link = New-AzureStorageBlobSASToken -Container 'dscmodules' -Blob $StorageLocation.Name -Context $StorageAccount.Context -FullUri `
                -Permission rwd -StartTime (Get-Date) -ExpiryTime (Get-Date).AddMinutes(60)

        # Use the blob SAS token to publish modules from Azure Storage to Automation Account
        $Module = New-AzureRmAutomationModule -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
                -Name $ModuleZip.BaseName -ContentLink $Link

        # Wait until the current module is successfully imported before moving to next module
        While ((Get-AzureRmAutomationModule -ResourceGroupName $ResourceGroupName -AutomationAccountName $AutomationAccountName `
                -Name $ModuleZip.BaseName).ProvisioningState -ne 'Succeeded') 
        {
            Start-Sleep -Seconds 5
        }
    }
}

# Delete all temporary folders created 
Remove-Item $DestinationFolder -Recurse -Force -ea SilentlyContinue