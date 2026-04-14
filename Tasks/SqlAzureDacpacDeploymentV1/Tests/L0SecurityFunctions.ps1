# Unit tests for SQL argument sanitization security functions (V2 refactor)
[CmdletBinding()]
param()

# Import test helpers
. $PSScriptRoot\MockVariable.ps1

# Import the functions under test
. $PSScriptRoot\..\Utility.ps1

Describe "Execute-Command - Original (Master) Code" {
    Context "Exact Master Behavior" {
        It "Should use Invoke-Expression with stop-parsing token" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $executeCommandSection = ($utilityContent -split 'function Execute-Command\s*\{')[1] -split 'function Execute-CommandV2' | Select-Object -First 1
            $executeCommandSection -match 'Invoke-Expression' | Should Be $true
        }

        It "Should NOT contain Should-UseSanitizedArguments" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $executeCommandSection = ($utilityContent -split 'function Execute-Command\s*\{')[1] -split 'function Execute-CommandV2' | Select-Object -First 1
            $executeCommandSection -match 'Should-UseSanitizedArguments' | Should Be $false
        }
    }
}

Describe "Execute-CommandV2 - Safe Execution" {
    Context "AST Parser Validation" {
        It "Should exist as a separate function" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $utilityContent -match 'function Execute-CommandV2' | Should Be $true
        }

        It "Should use AST Parser (not Invoke-Expression)" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $v2Section = ($utilityContent -split 'function Execute-CommandV2')[1] -split 'function ', 2 | Select-Object -First 1
            $v2Section -match 'System\.Management\.Automation\.Language\.Parser' | Should Be $true
            $v2Section -match 'Invoke-Expression' | Should Be $false
        }

        It "Should use token .Value instead of .Text" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $v2Section = ($utilityContent -split 'function Execute-CommandV2')[1] -split 'function ', 2 | Select-Object -First 1
            $v2Section -match 'ForEach-Object\s*\{\s*\$_\.Value\s*\}' | Should Be $true
        }

        It "Should use array invocation with & operator" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $v2Section = ($utilityContent -split 'function Execute-CommandV2')[1] -split 'function ', 2 | Select-Object -First 1
            $v2Section -match '& \$FileName \$argArray' | Should Be $true
        }
    }
}

Describe "Execute-SqlPackage - FF Dispatch" {
    Context "Feature Flag Dispatch" {
        It "Should call Execute-CommandV2 when FF enabled" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $sqlPackageSection = ($actionsContent -split 'function Execute-SqlPackage')[1] -split 'function ', 2 | Select-Object -First 1
            $sqlPackageSection -match 'Execute-CommandV2' | Should Be $true
        }

        It "Should call Execute-Command when FF disabled" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $sqlPackageSection = ($actionsContent -split 'function Execute-SqlPackage')[1] -split 'function ', 2 | Select-Object -First 1
            $sqlPackageSection -match 'Execute-Command -FileName' | Should Be $true
        }

        It "Should dispatch based on Should-UseSanitizedArguments" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $sqlPackageSection = ($actionsContent -split 'function Execute-SqlPackage')[1] -split 'function ', 2 | Select-Object -First 1
            $sqlPackageSection -match 'Should-UseSanitizedArguments' | Should Be $true
        }
    }
}

Describe "Run-SqlCmd - Original (Master) Code" {
    Context "Exact Master Behavior" {
        It "Should use Invoke-Expression" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $runSqlCmdSection = ($actionsContent -split 'function Run-SqlCmd\s*\{')[1] -split 'function Run-SqlCmdV2' | Select-Object -First 1
            $runSqlCmdSection -match 'Invoke-Expression \$commandToRun' | Should Be $true
        }

        It "Should NOT contain Should-UseSanitizedArguments" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $runSqlCmdSection = ($actionsContent -split 'function Run-SqlCmd\s*\{')[1] -split 'function Run-SqlCmdV2' | Select-Object -First 1
            $runSqlCmdSection -match 'Should-UseSanitizedArguments' | Should Be $false
        }
    }
}

Describe "Run-SqlCmdV2 - Safe Execution" {
    Context "AST Parser + Splat" {
        It "Should exist as a separate function" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $actionsContent -match 'function Run-SqlCmdV2' | Should Be $true
        }

        It "Should use AST Parser (not Invoke-Expression)" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $v2Section = ($actionsContent -split 'function Run-SqlCmdV2')[1] -split 'function ', 2 | Select-Object -First 1
            $v2Section -match 'System\.Management\.Automation\.Language\.Parser' | Should Be $true
            $v2Section -match 'Invoke-Expression' | Should Be $false
        }

        It "Should use splat invocation" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $v2Section = ($actionsContent -split 'function Run-SqlCmdV2')[1] -split 'function ', 2 | Select-Object -First 1
            $v2Section -match 'Invoke-SqlCmd @splatArgs' | Should Be $true
        }

        It "Should filter comma tokens for array parameters" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $v2Section = ($actionsContent -split 'function Run-SqlCmdV2')[1] -split 'function ', 2 | Select-Object -First 1
            $v2Section -match "\-ne ','" | Should Be $true
        }

        It "Should handle all authentication types" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $v2Section = ($actionsContent -split 'function Run-SqlCmdV2')[1] -split 'function ', 2 | Select-Object -First 1
            $v2Section -match 'authenticationType -eq "server"' | Should Be $true
            $v2Section -match 'authenticationType -eq "connectionString"' | Should Be $true
            $v2Section -match 'authenticationType -eq "servicePrincipal"' | Should Be $true
        }
    }
}

Describe "Run-SqlFiles / Run-InlineSql - FF Dispatch" {
    Context "Callers Dispatch Based on FF" {
        It "Run-SqlFiles should dispatch to Run-SqlCmdV2 when FF enabled" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $runSqlFilesSection = ($actionsContent -split 'function Run-SqlFiles')[1] -split 'function Run-InlineSql' | Select-Object -First 1
            $runSqlFilesSection -match 'Should-UseSanitizedArguments' | Should Be $true
            $runSqlFilesSection -match 'Run-SqlCmdV2' | Should Be $true
        }

        It "Run-InlineSql should dispatch to Run-SqlCmdV2 when FF enabled" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $runInlineSection = ($actionsContent -split 'function Run-InlineSql')[1] -split 'function Run-SqlCmd\b' | Select-Object -First 1
            $runInlineSection -match 'Should-UseSanitizedArguments' | Should Be $true
            $runInlineSection -match 'Run-SqlCmdV2' | Should Be $true
        }
    }
}

Describe "DeploySqlAzure.ps1 - No Upstream Sanitization" {
    Context "Clean Entry Point" {
        It "Should NOT call Get-SanitizedSqlArguments" {
            $deployContent = Get-Content "$PSScriptRoot\..\DeploySqlAzure.ps1" -Raw
            $deployContent -match 'Get-SanitizedSqlArguments' | Should Be $false
        }

        It "Should have original comments preserved" {
            $deployContent = Get-Content "$PSScriptRoot\..\DeploySqlAzure.ps1" -Raw
            $deployContent -match '# Initialize Rest API Helpers' | Should Be $true
            $deployContent -match '# Import the loc strings' | Should Be $true
        }
    }
}

Describe "Should-UseSanitizedArguments Dual-Gating Tests" {
    Context "Feature Flag Checks" {
        It "Should check org-level toggle" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $utilityContent -match 'Get-SanitizerCallStatus' | Should Be $true
        }

        It "Should check pipeline-level feature flag" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $utilityContent -match 'Get-VstsPipelineFeature.*EnableSqlAdditionalArgumentsSanitization' | Should Be $true
        }

        It "Should fail-open when VstsTaskSdk unavailable" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $utilityContent -match 'Get-Command.*Get-VstsPipelineFeature.*SilentlyContinue' | Should Be $true
        }
    }
}

Describe "Telemetry Tests" {
    Context "Publish-FeatureFlagCheckTelemetry" {
        It "Should emit telemetry with correct area and feature" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $utilityContent -match 'telemetry\.publish area=TaskHub;feature=SqlArgumentSanitizationCheck' | Should Be $true
        }
    }
}

Write-Host "Security function tests completed (V2 refactor)"
