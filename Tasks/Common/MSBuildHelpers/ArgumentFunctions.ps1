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
            $MSBuildArguments = "$MSBuildArguments /p:platform=`"$Platform`""
        }

        if ($Configuration) {
            $MSBuildArguments = "$MSBuildArguments /p:configuration=`"$Configuration`""
        }

        if ($VSVersion) {
            $MSBuildArguments = "$MSBuildArguments /p:VisualStudioVersion=`"$VSVersion`""
        }

        if ($MaximumCpuCount) {
            $MSBuildArguments = "$MSBuildArguments /m"
        }
        
        $userAgent = Get-UserAgentString
        if ($userAgent) {
            $MSBuildArguments = "$MSBuildArguments /p:_MSDeployUserAgent=`"$userAgent`""
        }

        $MSBuildArguments
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-UserAgentString
{
    [CmdletBinding()]
	param()

	Trace-VstsEnteringInvocation $MyInvocation
    try {
          if ($env:AZURE_HTTP_USER_AGENT) {
		      return $env:AZURE_HTTP_USER_AGENT
		  }
	} finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}
