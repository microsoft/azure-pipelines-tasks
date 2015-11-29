function Format-MSBuildArguments {
    [cmdletbinding()]
    param(
        [string]$MSBuildArguments,
        [string]$Platform,
        [string]$Configuration
    )

    if ($Platform) {
        Write-Verbose "Adding platform: $platform"
        $MSBuildArguments = "$MSBuildArguments /p:platform=`"$Platform`""
    }

    if ($Configuration) {
        Write-Verbose "Adding configuration: $Configuration"
        $MSBuildArguments = "$MSBuildArguments /p:configuration=`"$Configuration`""
    }

    Write-Verbose "MSBuildArguments = $MSBuildArguments"
    $MSBuildArguments
}

function Get-SolutionFiles {
    [cmdletbinding()]
    param(
        [string]$Solution
    )

    if (!$Solution) {
        throw (Get-LocalizedString -Key "Solution parameter not set on script")
    }

    # check for solution pattern
    if ($Solution.Contains("*") -or $Solution.Contains("?")) {
        Write-Verbose "Pattern found in solution parameter. Calling Find-Files."
        Write-Verbose "Find-Files -SearchPattern $Solution"
        $solutionFiles = Find-Files -SearchPattern $Solution
        $OFS = " "
        Write-Verbose "solutionFiles = $solutionFiles"
    } else {
        Write-Verbose "No Pattern found in solution parameter."
        $solutionFiles = ,$Solution
    }

    if (!$solutionFiles) {
        throw (Get-LocalizedString -Key "No solution was found using search pattern '{0}'." -ArgumentList $Solution)
    }

    $solutionFiles
}

function Invoke-BuildTools {
    [cmdletbinding()]
    param(
        [switch]$NuGetRestore,
        [string[]]$SolutionFiles,
        [string]$MSBuildLocation,
        [string]$MSBuildArguments,
        [switch]$Clean,
        [switch]$NoTimelineLogger
    )

    $nugetPath = Get-ToolPath -Name 'NuGet.exe'
    if (-not $nugetPath -and $NuGetRestore) {
        Write-Warning (Get-LocalizedString -Key "Unable to locate {0}. Package restore will not be performed for the solutions" -ArgumentList 'nuget.exe')
    }

    foreach ($file in $SolutionFiles) {
        if ($nugetPath -and $NuGetRestore) {
            if ($env:NUGET_EXTENSIONS_PATH) {
                Write-Host (Get-LocalizedString -Key "Detected NuGet extensions loader path. Environment variable NUGET_EXTENSIONS_PATH is set to: {0}" -ArgumentList $env:NUGET_EXTENSIONS_PATH)
            }

            $slnFolder = [System.IO.Path]::GetDirectoryName($file)
            Write-Verbose "Running nuget package restore for: $slnFolder"
            Invoke-Tool -Path $nugetPath -Arguments "restore `"$file`" -NonInteractive" -WorkingFolder $slnFolder
        }

        if ($Clean) {
            Invoke-MSBuild $file -Targets Clean -LogFile "$file-clean.log" -ToolLocation $MSBuildLocation -CommandLineArgs $MSBuildArguments -NoTimelineLogger:$NoTimelineLogger
        }

        Invoke-MSBuild $file -LogFile "$file.log" -ToolLocation $MSBuildLocation -CommandLineArgs $MSBuildArguments -NoTimelineLogger:$NoTimelineLogger
    }
}

function Select-MSBuildLocation {
    [cmdletbinding()]
    param(
        [string]$Method,
        [string]$Location,
        [string]$Version,
        [string]$Architecture
    )

    # Default the msbuildLocationMethod if not specified. The input msbuildLocationMethod
    # was added to the definition after the input msbuildLocation.
    if ("$Method".ToUpperInvariant() -ne 'LOCATION' -and "$Method".ToUpperInvariant() -ne 'VERSION') {
        # Infer the msbuildLocationMethod based on the whether msbuildLocation is specified.
        if ($Location) {
            $Method = 'location'
        } else {
            $Method = 'version'
        }

        Write-Verbose "Defaulted MSBuild location method to: $Method"
    }

    # Default to 'version' if the user chose 'location' but didn't specify a location.
    if ("$Method".ToUpperInvariant() -eq 'LOCATION' -and !$Location) {
        Write-Verbose 'Location not specified. Using version instead.'
        $Method = 'version'
    }

    if ("$Method".ToUpperInvariant() -eq 'VERSION') {
        $Location = ''

        # Look for a specific version of MSBuild.
        if ($Version -and "$Version".ToUpperInvariant() -ne 'LATEST') {
            Write-Verbose "Searching for MSBuild version: $Version"
            $Location = Get-MSBuildLocation -Version $Version -Architecture $Architecture

            # Warn if not found.
            if (!$Location) {
                Write-Warning (Get-LocalizedString -Key 'Unable to find MSBuild: Version = {0}, Architecture = {1}. Looking for the latest version.' -ArgumentList $Version, $Architecture)
            }
        }

        # Look for the latest version of MSBuild.
        if (!$Location) {
            Write-Verbose 'Searching for latest MSBuild version.'
            $Location = Get-MSBuildLocation -Version '' -Architecture $Architecture

            # Throw if not found.
            if (!$Location) {
                throw (Get-LocalizedString -Key 'MSBuild not found: Version = {0}, Architecture = {1}. Try a different version/architecture combination, specify a location, or install the appropriate MSBuild version/architecture.' -ArgumentList $Version, $Architecture)
            }
        }

        Write-Verbose "MSBuild location = $Location"
    }

    $Location
}
