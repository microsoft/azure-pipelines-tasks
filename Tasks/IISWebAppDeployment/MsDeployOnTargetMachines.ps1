param (
    [string]$WebDeployPackage,
    [string]$WebDeployParamFile,
    [string]$OverRideParams,
    [string]$MethodToInvoke
    )

Write-Verbose "Entering script MsDeployOnTargetMachines.ps1" -Verbose
Write-Verbose "WebDeployPackage = $WebDeployPackage" -Verbose
Write-Verbose "WebDeployParamFile = $WebDeployParamFile" -Verbose
Write-Verbose "OverRideParams = $OverRideParams" -Verbose
Write-Verbose "MethodToInvoke = $MethodToInvoke" -Verbose

function ThrowError
{
    param([string]$errorMessage)

        $readmelink = "http://aka.ms/iiswebappdeployreadme"
        $helpMessage = [string]::Format("For more info please refer to {0}", $readmelink)
        throw "$errorMessage $helpMessage"
}

function Get-MsDeployLocation
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$regKeyPath
    )

    $msDeployNotFoundError = "Can not find MsDeploy.exe location. Verify MsDeploy.exe is installed on $env:ComputeName and try operation again."
    try
    {
        $path = (Get-ChildItem -Path $regKeyPath | Select -Last 1).GetValue("InstallPath")

        if( -not (Test-Path $path))
        {
            ThrowError -errorMessage $msDeployNotFoundError 
        }
    }
    catch
    {
        ThrowError -errorMessage $msDeployNotFoundError
    }

    return (Join-Path $path msDeploy.exe)
}

function Get-MsDeployCmdArgs
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$webDeployPackage,
    [string]$webDeployParamFile,
    [string]$overRideParams
    )
    
    $webDeployPackage = $webDeployPackage.Trim()
    $webDeployParamFile = $webDeployParamFile.Trim()
    $overRideParams = $overRideParams.Trim()
    
    $msDeployCmdArgs = [string]::Empty
    if(-not [string]::IsNullOrEmpty($webDeployParamFile) -and $webDeployParamFile -ne "`"`"")
    {    
        $msDeployCmdArgs = [string]::Format(' -setParamFile={0}', $webDeployParamFile)
    }

    if(-not [string]::IsNullOrEmpty($overRideParams) -and $overRideParams -ne "`"`"")
    {
        $msDeployCmdArgs = [string]::Format("{0} -setParam:{1}", $msDeployCmdArgs, $overRideParams)
    }
    
    $msDeployCmdArgs = [string]::Format(' -verb:sync -source:package={0} {1} -dest:auto -verbose -retryAttempts:3 -retryInterval:3000', $webDeployPackage, $msDeployCmdArgs)
    return $msDeployCmdArgs
}

function Deploy-WebSite
{
    $msDeployInstallPathRegKey = "HKLM:\SOFTWARE\Microsoft\IIS Extensions\MSDeploy"
    $msDeployExePath = Get-MsDeployLocation -regKeyPath $msDeployInstallPathRegKey
    $msDeployCmdArgs = Get-MsDeployCmdArgs -webDeployPackage $WebDeployPackage -webDeployParamFile $WebDeployParamFile -overRideParams $OverRideParams

    $msDeployCmd = "`"$msDeployExePath`" $msDeployCmdArgs"
    Write-Verbose "Executing MSDeploy Command: $msDeployCmd" -Verbose
    cmd.exe /c "`"$msDeployCmd`""
}

Invoke-Expression $MethodToInvoke
