# Unit tests for SQL argument sanitization security functions
[CmdletBinding()]
param()

# Import test helpers
. $PSScriptRoot\MockVariable.ps1

# Import the functions under test
. $PSScriptRoot\..\Utility.ps1

Describe "Execute-Command Security Tests" {
    Context "AST Parser Validation" {
        It "Should use token .Value instead of .Text" {
            # This test verifies the fix for Ivan's concern about quote handling
            # We check that the code uses $_.Value which removes quotes,
            # rather than $_.Text which keeps them (causing double-quoting)
            
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $utilityContent -match 'ForEach-Object\s*\{\s*\$_\.Value\s*\}' | Should Be $true
            $utilityContent -match 'ForEach-Object\s*\{\s*\$_\.Text\s*\}' | Should Be $false
        }

        It "Should validate parse errors before execution" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            # Should check parseErrors and throw if any exist
            $utilityContent -match 'if\s*\(\s*\$parseErrors' | Should Be $true
            $utilityContent -match 'throw.*Invalid sqlpackage argument' | Should Be $true
        }

        It "Should have FF-gated dual-path in Execute-Command" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $executeCommandSection = $utilityContent -split 'function Execute-Command'
            if ($executeCommandSection.Count -gt 1) {
                $functionBody = $executeCommandSection[1] -split 'function ', 2 | Select-Object -First 1
                # Should have FF check
                $functionBody -match 'Should-UseSanitizedArguments' | Should Be $true
            }
        }
    }
}

Describe "Should-UseSanitizedArguments Dual-Gating Tests" {
    Context "Backward Compatibility" {
        It "Should fail-open when VstsTaskSdk unavailable" {
            # When Get-VstsPipelineFeature cmdlet doesn't exist,
            # should return false (backward compatibility)
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $utilityContent -match 'Get-Command.*Get-VstsPipelineFeature.*SilentlyContinue' | Should Be $true
        }
    }
}

Describe "Get-SanitizedSqlArguments Security Tests" {
    Context "Fail-Closed Behavior" {
        It "Should validate sanitizer returns an array" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            # Should check that result is an array type
            $utilityContent -match '\$sanitizedArray -isnot \[Array\]' | Should Be $true
            $utilityContent -match 'throw.*unexpected type' | Should Be $true
        }

        It "Should detect empty array (all input blocked)" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            # Should check for empty array
            $utilityContent -match '\$sanitizedArray\.Count -eq 0' | Should Be $true
            $utilityContent -match 'throw.*empty array.*blocked' | Should Be $true
        }

        It "Should throw on sanitizer failure" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            # Should have try-catch that throws on error
            $getSanitizedSection = $utilityContent -split 'function Get-SanitizedSqlArguments'
            if ($getSanitizedSection.Count -gt 1) {
                $functionBody = $getSanitizedSection[1] -split 'function ', 2 | Select-Object -First 1
                $functionBody -match 'catch\s*\{' | Should Be $true
                $functionBody -match 'SECURITY ERROR.*Failed to sanitize' | Should Be $true
                $functionBody -match 'throw\s*\$errorMessage' | Should Be $true
            }
        }
    }

    Context "Telemetry" {
        It "Should emit telemetry when sanitization modifies input" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $utilityContent -match 'if\s*\(\s*\$sanitizedString -ne \$InputArgs\s*\)' | Should Be $true
            $utilityContent -match 'telemetry\.publish.*SqlArgumentSanitization' | Should Be $true
        }
    }
}

Describe "Publish-FeatureFlagCheckTelemetry Tests" {
    Context "Telemetry Format" {
        It "Should emit telemetry with correct area and feature" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $utilityContent -match 'telemetry\.publish area=TaskHub;feature=SqlArgumentSanitizationCheck' | Should Be $true
        }

        It "Should include checkType in telemetry data" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            # Function should accept CheckType parameter and include in data
            $telemetrySection = $utilityContent -split 'function Publish-FeatureFlagCheckTelemetry'
            if ($telemetrySection.Count -gt 1) {
                $functionBody = $telemetrySection[1] -split 'function ', 2 | Select-Object -First 1
                $functionBody -match 'checkType\s*=' | Should Be $true
            }
        }
    }
}

Describe "Comment Restoration Tests" {
    Context "Original Comments" {
        It "Should have 'Initialize Rest API Helpers' comment in DeploySqlAzure.ps1" {
            $deployContent = Get-Content "$PSScriptRoot\..\DeploySqlAzure.ps1" -Raw
            $deployContent -match '# Initialize Rest API Helpers' | Should Be $true
        }

        It "Should have 'Import the loc strings' comment in DeploySqlAzure.ps1" {
            $deployContent = Get-Content "$PSScriptRoot\..\DeploySqlAzure.ps1" -Raw
            $deployContent -match '# Import the loc strings' | Should Be $true
        }

        It "Should have function comment in Utility.ps1" {
            $utilityContent = Get-Content "$PSScriptRoot\..\Utility.ps1" -Raw
            $utilityContent -match '# Function to import SqlPS module' | Should Be $true
        }
    }
}

Describe "Run-SqlCmd FF Gating Tests" {
    Context "Feature Flag Dual-Path" {
        It "Should have FF-gated dual-path in Run-SqlCmd" {
            $actionsContent = Get-Content "$PSScriptRoot\..\SqlAzureActions.ps1" -Raw
            $actionsContent -match 'if\s*\(\s*Should-UseSanitizedArguments\s*\)' | Should Be $true
        }
    }
}

Describe "Upstream Sanitization FF Gating Tests" {
    Context "DeploySqlAzure.ps1 Sanitization" {
        It "Should wrap sanitization with FF check" {
            $deployContent = Get-Content "$PSScriptRoot\..\DeploySqlAzure.ps1" -Raw
            ($deployContent -match 'Should-UseSanitizedArguments') -and ($deployContent -match 'Get-SanitizedSqlArguments') | Should Be $true
        }
    }
}

Write-Host "Security function tests completed"
