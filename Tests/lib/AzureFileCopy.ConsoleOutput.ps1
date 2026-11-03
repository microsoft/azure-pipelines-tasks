[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$TaskDirectory)

. $PSScriptRoot\Initialize-Test.ps1
. "$TaskDirectory\Utility.ps1"
. "$PSScriptRoot\..\..\Tasks\Common\Sanitizer\ArgumentsSanitizer.ps1"

$major = (Get-Content -LiteralPath "$TaskDirectory\task.json" -Raw | ConvertFrom-Json).version.Major
$uploadResponse = @{ Status = 'Succeeded' }
$endpoint = @{ Auth = @{ Scheme = 'ManagedServiceIdentity' }; Data = @{} }
$azCopyExeLocation = 'Invoke-ConsoleOutputAzCopy'
$script:calls = @()
$script:toolOutput = @()
$script:toolExitCode = 0
function global:Remove-EndpointSecrets { }
function global:Write-Telemetry { }
function global:Invoke-ConsoleOutputAzCopy {
    $script:calls += ,@($args)
    $script:toolOutput
    $global:LASTEXITCODE = $script:toolExitCode
}
Register-Mock Join-Path { 'Invoke-ConsoleOutputAzCopy' }
Register-Mock Get-VstsTaskVariable { 'console-response-file' }
Register-Mock Test-Path { param($Path, $PathType) $Path -eq 'console-response-file' }
Register-Mock Copy-FilesToAzureBlob { $script:toolOutput }

function Assert-ConsoleText {
    param([object[]]$Output, [int]$CommandCount)

    $actualCommandCount = 0
    foreach ($item in $Output) {
        $text = "$item"
        if ($text.StartsWith('##[command]')) {
            $actualCommandCount++
            $text = $text.Substring('##[command]'.Length)
        }
        if ($script:consoleOutputSanitizationFixEnabled) {
            Assert-AreEqual $false ($text.Contains('##vso[') -or $text.Contains('##[')) 'Untrusted console text contains an active command marker.'
        }
    }
    Assert-AreEqual $CommandCount $actualCommandCount 'Task-authored command prefixes must remain functional.'
}

# These are deliberately inert, unsupported commands; no agent commands are executed.
$cases = @(
    @{ Source = 'C:\source'; Prefix = 'folder' },
    @{ Source = 'C:\source##vso[console-sentinel]tail'; Prefix = 'folder##[console-sentinel]tail' },
    @{ Source = "C:\source`r##[console-sentinel]`n##vso[console-sentinel]"; Prefix = "folder`r`n##vso[console-sentinel]##[console-sentinel]" }
)
$modes = @(
    @{ useSourcePathHardening = $false; useSanitizerActivate = $false },
    @{ useSourcePathHardening = $false; useSanitizerActivate = $true },
    @{ useSourcePathHardening = $true; useSanitizerActivate = $false },
    @{ useSourcePathHardening = $true; useSanitizerActivate = $true }
)
if ($major -eq 1) { $modes = @(@{}) }
if ($major -eq 1) { Register-Mock Copy-FilesSequentiallyToAzureVMs { } }
if ($major -eq 4 -or $major -eq 5) {
    Register-Mock ConvertTo-Pfx { 'C:\certificate##[console-sentinel].pfx', 'test-password' }
    $authCases = @(
        $endpoint,
        @{ Auth = @{ Scheme = 'ServicePrincipal'; Parameters = @{
            AuthenticationType = 'SPNKey'; ServicePrincipalId = 'application##vso[console-sentinel]'
            TenantId = 'tenant'; ServicePrincipalKey = 'test-key'
        } }; Data = @{} },
        @{ Auth = @{ Scheme = 'ServicePrincipal'; Parameters = @{
            AuthenticationType = 'SPNCertificate'; ServicePrincipalId = 'application##vso[console-sentinel]'
            TenantId = 'tenant'; ServicePrincipalCertificate = 'test-certificate'
        } }; Data = @{} }
    )
} else {
    $authCases = @($endpoint)
}

# Use the real SDK feature reader and protocol encoder, without its host overrides.
Unregister-Mock Import-Module
$featureState = @{ Value = $null; Reads = 0; Throw = $false }
$sdk = New-Module -ScriptBlock {
    param($Path, $State)
    $script:state = $State
    . "$Path\InputFunctions.ps1"
    . "$Path\LoggingCommandFunctions.ps1"
    function Get-TaskVariable {
        param($Name)
        if ($Name -cne 'DistributedTask.Tasks.AzureFileCopy.ConsoleOutputSanitizationFixEnabled') {
            throw 'Unexpected feature name.'
        }
        $script:state.Reads++
        if ($script:state.Throw) { throw 'sensitive lookup exception console-sentinel' }
        return $script:state.Value
    }
    Export-ModuleMember -Function Write-SetVariable
} -ArgumentList "$TaskDirectory\ps_modules\VstsTaskSdk", $featureState
Import-Module $sdk -Prefix Vsts
Register-Mock Import-Module

$tokens = $null
$parseErrors = $null
$main = [System.Management.Automation.Language.Parser]::ParseFile("$TaskDirectory\AzureFileCopy.ps1", [ref]$tokens, [ref]$parseErrors)
Assert-AreEqual 0 $parseErrors.Count
$initializers = @($main.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
    $node.Extent.Text -ceq '$script:consoleOutputSanitizationFixEnabled = Get-ConsoleOutputSanitizationFeatureFlag'
}, $true))
Assert-AreEqual 1 $initializers.Count 'Each task must read its console flag exactly once.'

foreach ($flagCase in @('enabled', 'disabled', 'unset', 'lookup failure', 'missing cmdlet')) {
    $featureState.Value = $(if ($flagCase -eq 'enabled') { 'true' } elseif ($flagCase -eq 'disabled') { 'false' } else { $null })
    $featureState.Throw = $flagCase -eq 'lookup failure'
    $featureState.Reads = 0
    function global:Get-VstsPipelineFeature {
        [CmdletBinding()]
        param([string]$FeatureName)
        & $sdk { param($Name) Get-PipelineFeature -FeatureName $Name } $FeatureName
    }
    if ($flagCase -eq 'missing cmdlet') {
        Remove-Item Function:\Get-VstsPipelineFeature
    }
    . ([scriptblock]::Create($initializers[0].Extent.Text))
    $enabled = $flagCase -eq 'enabled'
    Assert-AreEqual $enabled $script:consoleOutputSanitizationFixEnabled "Incorrect flag state: $flagCase"
    $expectedReads = $(if ($flagCase -eq 'missing cmdlet') { 0 } else { 1 })
    Assert-AreEqual $expectedReads $featureState.Reads
    $diagnostics = @(Get-ConsoleOutputSanitizationFeatureFlag -Verbose 4>&1)
    Assert-AreEqual $false ("$diagnostics".Contains('sensitive lookup exception')) 'Lookup diagnostics leaked exception data.'
    $featureState.Reads = 0

foreach ($case in $cases) {
    foreach ($authCase in $authCases) {
    foreach ($mode in $modes) {
        $script:calls = @()
        $script:toolOutput = @('ordinary tool output', "echo: $($case.Source) $($case.Prefix)")
        $parameters = @{
            sourcePath = $case.Source
            storageAccountName = 'storage'
            containerName = 'container'
            blobPrefix = $case.Prefix
            blobStorageEndpoint = 'https://storage.example/'
            azCopyLocation = 'C:\tools'
            additionalArguments = $(if ($major -le 3) { '/Pattern:*.txt' } else { '--include-pattern=*.txt' })
            destinationType = 'AzureBlob'
        }
        if ($major -le 3) { $parameters.storageKey = 'test-key' }
        if ($major -ge 4) { $parameters.endPoint = $authCase }
        if ($major -ge 2) {
            $parameters.useDefaultArguments = $false
            foreach ($key in $mode.Keys) { $parameters[$key] = $mode[$key] }
        }
        if ($major -ge 5) { $parameters.cleanTargetBeforeCopy = $true }

        $output = @(Upload-FilesToAzureContainer @parameters 6>&1)
        $commandCount = 1
        if ($major -eq 1) { $commandCount = 0 }
        if ($major -ge 5) { $commandCount = 2 }
        if ($major -eq 4 -or $major -eq 5) { $commandCount += 2 }
        Assert-ConsoleText -Output $output -CommandCount $commandCount
        Assert-AreEqual $true ($output -contains 'ordinary tool output') 'Ordinary tool output changed.'
        Assert-AreEqual $true (@($output | Where-Object { "$_" -like 'AFC_UploadFilesStorageAccount *' }).Count -eq 1) 'Upload start message was not exercised.'
        Assert-AreEqual $true (@($output | Where-Object { "$_" -like 'AFC_UploadFileSuccessful *' }).Count -eq 1) 'Upload success message was not exercised.'
        $expectedEcho = "echo: $($case.Source) $($case.Prefix)"
        if ($enabled) { $expectedEcho = $expectedEcho.Replace('##vso[', '# #vso[').Replace('##[', '# #[') }
        Assert-AreEqual $true ($output -contains $expectedEcho) "Native stdout mismatch: $flagCase"
        $expectedEchoCount = $(if ($major -eq 1) { 1 } else { $commandCount })
        Assert-AreEqual $expectedEchoCount @($output | Where-Object { "$_" -ceq $expectedEcho }).Count 'Not all native stdout was forwarded.'
        if (-not $enabled) {
            Assert-AreEqual $true ($output -contains "AFC_UploadFilesStorageAccount $($case.Source) storage container $($case.Prefix)") 'Legacy upload log changed.'
            Assert-AreEqual $true ($output -contains "AFC_UploadFileSuccessful $($case.Source) storage container $($case.Prefix)") 'Legacy success log changed.'
        }
        if ($major -eq 4 -or $major -eq 5) {
            Assert-AreEqual $true ($script:calls[0] -contains 'login') 'Login branch was not executed.'
            Assert-AreEqual $true ($script:calls[-1] -contains 'logout') 'Logout branch was not executed.'
            if ($authCase.Auth.Scheme -eq 'ServicePrincipal') {
                Assert-AreEqual $true ($script:calls[0] -contains 'application##vso[console-sentinel]') 'Login argument was modified.'
                $expectedLoginDisplay = ' & "Invoke-ConsoleOutputAzCopy" login --service-principal --application-id "application##vso[console-sentinel]"'
                if ($authCase.Auth.Parameters.AuthenticationType -eq 'SPNCertificate') {
                    $expectedLoginDisplay += ' --certificate-path "C:\certificate##[console-sentinel].pfx"'
                }
                $expectedLoginDisplay += ' --tenant-id="tenant" --aad-endpoint "https://login.microsoftonline.com/"'
            } else {
                $expectedLoginDisplay = ' & "Invoke-ConsoleOutputAzCopy" login --identity --aad-endpoint "https://login.microsoftonline.com/"'
            }
            if ($enabled) { $expectedLoginDisplay = $expectedLoginDisplay.Replace('##vso[', '# #vso[').Replace('##[', '# #[') }
            Assert-AreEqual $true ($output -contains ("##[command]" + $expectedLoginDisplay)) 'Login display command changed unexpectedly.'
            Assert-AreEqual $true ($output -contains '##[command] & "Invoke-ConsoleOutputAzCopy" logout') 'Logout display command changed.'
        }

        if ($major -eq 1) {
            Assert-WasCalled Copy-FilesToAzureBlob -ParametersEvaluator {
                $SourcePathLocation -ceq $case.Source -and $BlobPrefix -ceq $case.Prefix -and
                $AdditionalArguments -ceq '/Pattern:*.txt'
            }
        } else {
            $expectedDestination = 'https://storage.example/container/' + $case.Prefix
            $displayArguments = $parameters.additionalArguments
            if ($major -le 3) {
                $displayExe = '"Invoke-ConsoleOutputAzCopy"'
                if ($major -eq 3 -and $mode.useSanitizerActivate -and -not $mode.useSourcePathHardening) {
                    $displayExe = 'azcopy'
                }
                $expectedCopyDisplay = " & $displayExe /Source:`"$($case.Source)`" /Dest:`"$expectedDestination`" /@:`"console-response-file`" $displayArguments"
            } else {
                $argumentSpacing = $(if ($mode.useSourcePathHardening -or $mode.useSanitizerActivate) { ' ' } else { '  ' })
                $expectedCopyDisplay = " & `"Invoke-ConsoleOutputAzCopy`" copy `"$($case.Source)`" `"$expectedDestination`"$argumentSpacing$displayArguments"
            }
            if ($enabled) { $expectedCopyDisplay = $expectedCopyDisplay.Replace('##vso[', '# #vso[').Replace('##[', '# #[') }
            Assert-AreEqual $true ($output -contains ("##[command]" + $expectedCopyDisplay)) "Copy display mismatch V${major}, $flagCase, source=$($mode.useSourcePathHardening), sanitizer=$($mode.useSanitizerActivate)."
            if ($major -ge 5) {
                $expectedRemoveDisplay = " & `"Invoke-ConsoleOutputAzCopy`" rm `"$expectedDestination`" --recursive=true"
                if ($enabled) { $expectedRemoveDisplay = $expectedRemoveDisplay.Replace('##vso[', '# #vso[').Replace('##[', '# #[') }
                Assert-AreEqual $true ($output -contains ("##[command]" + $expectedRemoveDisplay)) 'Removal display command changed unexpectedly.'
            }
            $copyIndex = 0
            if ($major -eq 4 -or $major -eq 5) { $copyIndex++ }
            if ($major -ge 5) { $copyIndex++ }
            $copy = $script:calls[$copyIndex]
            Assert-AreEqual $true ("$($copy[-1])" -ceq $parameters.additionalArguments) 'Additional operation argument changed.'
            if ($major -le 3) {
                Assert-AreEqual $true ($copy[0] -ceq ('/Source:' + $case.Source)) 'Literal source argument changed.'
                Assert-AreEqual $true ($copy[1] -ceq ('/Dest:' + $expectedDestination)) 'Literal destination argument changed.'
            } else {
                Assert-AreEqual 'copy' $copy[0]
                Assert-AreEqual $true ($copy[1] -ceq $case.Source) 'Literal source argument changed.'
                Assert-AreEqual $true ($copy[2] -ceq $expectedDestination) 'Literal destination argument changed.'
            }
            if ($major -ge 5) {
                Assert-AreEqual $commandCount $script:calls.Count
                Assert-AreEqual 'rm' $script:calls[$copyIndex - 1][0]
                Assert-AreEqual $true ($script:calls[$copyIndex - 1][1] -ceq $expectedDestination) 'Clean-target destination changed.'
            }
            }
        }
        if ($case -eq $cases[0]) {
            Assert-AreEqual $true ($output -contains 'AFC_UploadFilesStorageAccount C:\source storage container folder') 'Ordinary upload log changed.'
            Assert-AreEqual $true ($output -contains 'AFC_UploadFileSuccessful C:\source storage container folder') 'Ordinary success log changed.'
        }
    }
}

# Failed native operations must retain their exit status and emit only safe output.
if ($major -ge 2) {
    foreach ($mode in $modes) {
    foreach ($key in $mode.Keys) { $parameters[$key] = $mode[$key] }
    $script:toolExitCode = 1
    $script:toolOutput = @("failure`r`n##vso[console-sentinel]##[console-sentinel]")
    $output = @()
    $failure = $null
    try {
        Upload-FilesToAzureContainer @parameters | ForEach-Object { $output += $_ }
    } catch {
        $failure = $_
    }
    Assert-AreEqual $true ($null -ne $failure) 'A failed native copy must still fail the task.'
    Assert-AreEqual $true ($failure.Exception.Message.Contains('AFC_AzCopyBlobUploadNonZeroExitCode')) 'Native failure was replaced by another error.'
    Assert-AreEqual 1 $global:LASTEXITCODE 'Filtering stdout lost the native exit code.'
    Assert-ConsoleText -Output $output -CommandCount $commandCount
    $expectedFailure = $script:toolOutput[0]
    if ($enabled) { $expectedFailure = $expectedFailure.Replace('##vso[', '# #vso[').Replace('##[', '# #[') }
    Assert-AreEqual $true ($output -contains $expectedFailure) 'Native failure stdout changed unexpectedly.'
    Assert-AreEqual $false (@($output | Where-Object { "$_" -like 'AFC_UploadFileSuccessful *' }).Count -gt 0) 'Failed copies must not log success.'
    $script:toolExitCode = 0
    }
}

# Execute the actual main-script sink statements, without initializing cloud services.
# AST selection keeps these checks tied to production code, not copied expressions.
$sourcePath = $cases[2].Source
$environmentName = $cases[2].Prefix
if ($major -ge 2) {
    $successSinks = @($main.FindAll({
        param($node)
        $node -is [System.Management.Automation.Language.PipelineAst] -and
        $node.Extent.Text.StartsWith('Write-Output ') -and $node.Extent.Text.Contains('"AFC_CopySuccessful"')
    }, $true))
    Assert-AreEqual 1 $successSinks.Count
    $output = @(& ([scriptblock]::Create($successSinks[0].Extent.Text)))
    Assert-ConsoleText -Output $output -CommandCount 0
    $expectedSuccess = "AFC_CopySuccessful $sourcePath $environmentName"
} else {
    $output = @(Copy-FilesToAzureVMsFromStorageContainer -storageAccountName 'storage' `
        -containerName 'container' -containerSasToken 'test-token' -targetPath 'C:\target' `
        -azCopyLocation 'C:\tools' -resourceGroupName $environmentName `
        -azureVMResourcesProperties @{ vm = @{} } -azureVMsCredentials @{} `
        -cleanTargetBeforeCopy 'false' -enableDetailedLoggingString 'false' `
        -copyFilesInParallel 'false' -connectionType 'ServicePrincipal')
    Assert-ConsoleText -Output $output -CommandCount 0
    Assert-AreEqual 1 $output.Count
    $expectedSuccess = "AFC_CopySuccessful $sourcePath $environmentName"
}
if ($enabled) { $expectedSuccess = $expectedSuccess.Replace('##vso[', '# #vso[').Replace('##[', '# #[') }
Assert-AreEqual $expectedSuccess "$($output[-1])" 'VM success message changed unexpectedly.'

$outputStorageURI = "custom;name]`r`nvalue"
$outputStorageContainerSASToken = 'customToken'
$storageAccountContainerURI = "https://storage.example/container`r`n##vso[console-sentinel]"
$storageContainerSasToken = 'test-token'
$variableSinks = @($main.FindAll({
    param($node)
    $node -is [System.Management.Automation.Language.IfStatementAst] -and
    $node.Clauses[0].Item1.Extent.Text -ceq '$script:consoleOutputSanitizationFixEnabled' -and
    $node.Extent.Text.Contains('Write-VstsSetVariable ')
}, $true))
Assert-AreEqual $(if ($major -eq 6) { 1 } else { 2 }) $variableSinks.Count
$variableOutput = @(& ([scriptblock]::Create($variableSinks[0].Extent.Text)) 6>&1)
$command = "$($variableOutput[-1])"
Assert-AreEqual 1 $variableOutput.Count
Assert-AreEqual $true $command.StartsWith('##vso[task.setvariable ') 'Output variable command is missing.'
if ($enabled) {
Assert-AreEqual $false ($command.Contains("`r") -or $command.Contains("`n")) 'Variable data can introduce another console command.'
if ($major -le 3) {
    Assert-AreEqual $true ($command -match 'variable=custom%3Bname%5D%0D%0Avalue[;\]]') 'User-selected variable name was not preserved and encoded.'
} else {
    Assert-AreEqual $true ($command -match 'variable=StorageContainerUri[;\]]') 'Output variable name changed.'
}
Assert-AreEqual $true $command.EndsWith('https://storage.example/container%0D%0A##vso[console-sentinel%5D') 'Variable data must use SDK protocol encoding, not plain-text neutralization.'
Assert-AreEqual $true ($command -match 'issecret=False[;\]]') 'URI output variable visibility changed.'
} else {
    $expectedCommand = $(if ($major -le 3) {
        "##vso[task.setvariable variable=$outputStorageURI;]$storageAccountContainerURI"
    } else {
        "##vso[task.setvariable variable=StorageContainerUri]$storageAccountContainerURI"
    })
    Assert-AreEqual $expectedCommand $command 'Legacy output variable command changed.'
}
if ($major -ne 6) {
    $tokenOutput = @(& ([scriptblock]::Create($variableSinks[1].Extent.Text)) 6>&1)
    Assert-AreEqual $true "$($tokenOutput[-1])".EndsWith(']test-token')
    if ($enabled) {
        Assert-AreEqual $true ("$($tokenOutput[-1])" -match 'issecret=False[;\]]') 'Output variable visibility changed.'
    } else {
        $expectedTokenCommand = $(if ($major -le 3) {
            "##vso[task.setvariable variable=$outputStorageContainerSASToken;]$storageContainerSasToken"
        } else {
            "##vso[task.setvariable variable=StorageContainerSasToken]$storageContainerSasToken"
        })
        Assert-AreEqual $expectedTokenCommand "$($tokenOutput[-1])" 'Legacy token output command changed.'
    }
    $tokenName = $(if ($major -le 3) { 'customToken' } else { 'StorageContainerSasToken' })
    Assert-AreEqual $true ("$($tokenOutput[-1])" -match "variable=$tokenName[;\]]") 'Token variable name changed.'
    $storageContainerSasToken = "test-token`r`n##vso[console-sentinel]`r##[console-sentinel]"
    $tokenOutput = @(& ([scriptblock]::Create($variableSinks[1].Extent.Text)) 6>&1)
    Assert-AreEqual 1 $tokenOutput.Count
    if ($enabled) {
        Assert-AreEqual $true "$($tokenOutput[0])".EndsWith(']test-token%0D%0A##vso[console-sentinel%5D%0D##[console-sentinel%5D') 'Token value must use SDK protocol encoding.'
        Assert-AreEqual $true ("$($tokenOutput[0])" -match 'issecret=False[;\]]') 'Token visibility changed.'
    } else {
        $legacyName = $(if ($major -le 3) { "$tokenName;" } else { $tokenName })
        Assert-AreEqual "##vso[task.setvariable variable=$legacyName]$storageContainerSasToken" "$($tokenOutput[0])" 'Legacy token value changed.'
    }
}

if ($major -eq 1 -and -not $enabled) {
    $nativeObject = [pscustomobject]@{ Status = 'native object'; Marker = '##vso[console-sentinel]' }
    $script:toolOutput = @($nativeObject, 42)
    $output = @(Upload-FilesToAzureContainer @parameters)
    Assert-AreEqual $true ([object]::ReferenceEquals($nativeObject, $output[1])) 'Legacy V1 object stdout was coerced.'
    Assert-AreEqual $true ($output[2] -is [int]) 'Legacy V1 numeric stdout was coerced.'
}
Assert-AreEqual 0 $featureState.Reads 'Console sinks must not read the feature flag again.'
}
