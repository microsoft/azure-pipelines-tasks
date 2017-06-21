[CmdletBinding()]
param()

Trace-VstsEnteringInvocation $MyInvocation
try {
    $symbolServerType = Get-VstsInput -Name 'SymbolServerType' -Require

    if ($SymbolServerType -eq "FileShare")
    {
        & "$PSScriptRoot\PublishSymbols.ps1"
    }
    elseif ($symbolServerType -eq "TeamServices")
    {
        [string]$teamProject = Get-VstsTaskVariable -Name 'System.TeamProject' -Require
        [string]$buildNumber = Get-VstsTaskVariable -Name 'Build.BuildNumber' -Require
        [string]$buildId = Get-VstsTaskVariable -Name 'Build.BuildId' -Require
        [string]$serviceUri = Get-VstsTaskVariable -Name 'System.TeamFoundationCollectionUri' -Require

        [string]$requestName = "$teamProject/$buildNumber/$buildId/$([Guid]::NewGuid())".ToLower()
        [string]$symbolServiceUri = "$serviceUri" -replace ".visualstudio.com",".artifacts.visualstudio.com"
        $symbolServiceUri = $symbolServiceUri.TrimEnd('/')
        [bool]$detailedLog = (Get-VstsInput -Name 'DetailedLog' -AsBool -Default $false) -or ($PSBoundParameters.Verbose -eq $true)
        [string]$sourcePath = Get-VstsInput -Name 'SymbolsFolder' -Require

        Write-Verbose "Symbol Request Name = $requestName"

        $endpoint = Get-VstsEndPoint -Name "SystemVssConnection"
        [string]$personalAccessToken = $endpoint.Auth.Parameters.AccessToken

        if ( [string]::IsNullOrEmpty($personalAccessToken) )
        {
            throw "Unable to generate Personal Access Token for the user. Contact Project Collection Administrator"
        }

        & "$PSScriptRoot\Publish-Symbols.ps1" -SymbolServiceUri $symbolServiceUri -RequestName $requestName -SourcePath $sourcePath -PersonalAccessToken $personalAccessToken -Verbose:$detailedLog -ExpirationInDays 3653
    }
    else
    {
        throw "Unknown SymbolServerType : $SymbolServerType"
    }
} finally {
    Trace-VstsLeavingInvocation $MyInvocation
}
exit $lastexitcode
