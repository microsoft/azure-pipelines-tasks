function Format-MSBuildArguments {
    [CmdletBinding()]
    param(
        [string]$MSBuildArguments,
        [string]$Platform,
        [string]$Configuration,
        [string]$VSVersion,
        [string]$OutDir,
        [switch]$MaximumCpuCount,
        [switch]$GenerateProjectSpecificOutputFolder)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        if ($Platform) {
            $MSBuildArguments = "$MSBuildArguments /p:platform=`"$Platform`""
        }

        if ($Configuration) {
            $MSBuildArguments = "$MSBuildArguments /p:configuration=`"$Configuration`""
        }

        if ($VSVersion) {
            $MSBuildArguments = "$MSBuildArguments /p:VisualStudioVersion=`"$VSVersion`""
        }

        if ($OutDir) {
            $MSBuildArguments = "$MSBuildArguments /p:OutDir=`"$OutDir`""
        }

        if ($MaximumCpuCount) {
            $MSBuildArguments = "$MSBuildArguments /m"
        }

        if ($GenerateProjectSpecificOutputFolder) {
            $MSBuildArguments = "$MSBuildArguments /p:GenerateProjectSpecificOutputFolder=true"
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