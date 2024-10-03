function Format-MSBuildArguments {
    [CmdletBinding()]
    param(
        [string]$MSBuildArguments,
        [string]$Platform,
        [string]$Configuration,
        [string]$VSVersion,
        [switch]$MaximumCpuCount)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if ($Platform) {
            Test-MSBuildParam $Platform 'Platform'
            $MSBuildArguments = "$MSBuildArguments /p:platform=`"$Platform`""
        }

        if ($Configuration) {
            Test-MSBuildParam $Configuration 'Configuration'
            $MSBuildArguments = "$MSBuildArguments /p:configuration=`"$Configuration`""
        }

        if ($VSVersion) {
            $MSBuildArguments = "$MSBuildArguments /p:VisualStudioVersion=`"$VSVersion`""
        }

        if ($MaximumCpuCount) {
            $MSBuildArguments = "$MSBuildArguments /m"
        }
        
        $userAgent = Get-VstsTaskVariable -Name AZURE_HTTP_USER_AGENT
        if ($userAgent) {
            $MSBuildArguments = "$MSBuildArguments /p:_MSDeployUserAgent=`"$userAgent`""
        }

        $MSBuildArguments
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Test-MSBuildParam ([string]$msbuildParam, [string]$parameterName)
{
    if ($msBuildParam -match '[<>*|:\/&%"#?]')
    {
        throw "The value of MSBuild parameter '$parameterName' ($msBuildParam) contains an invalid character. The value of $parameterName may not contain any of the following characters: < > * | : \ / & % `" # ?"
    }
}