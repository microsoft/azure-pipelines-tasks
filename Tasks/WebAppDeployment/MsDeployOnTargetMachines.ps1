param (
    [string]$webDeployPackage,
    [string]$webDeployParamFile,
    [string]$overRideParams
    )

Write-Verbose "Entering script MsDeployOnTargetMachines.ps1" -Verbose
Write-Verbose "webDeployPackage = $webDeployPackage" -Verbose
Write-Verbose "webDeployParamFile = $webDeployParamFile" -Verbose
Write-Verbose "overRideParams = $overRideParams" -Verbose

function ThrowError
{
    param([string]$errorMessage)

        $readmelink = "https://github.com/Microsoft/vso-agent-tasks/blob/master/Tasks/WebAppDeployment/README.md"
        $helpMessage = [string]::Format("For more info please refer to {0}", $readmelink)
        throw "$errorMessage $helpMessage"
}

function Get-MsDeployLocation
{
    $msDeployNotFoundError = "Can not find MsDeploy.exe location. Verify MsDeploy.exe is installed on $env:ComputeName and try operation again."
    try
    {
        $path = (Get-ChildItem "HKLM:\SOFTWARE\Microsoft\IIS Extensions\MSDeploy" | Select -Last 1).GetValue("InstallPath")

        if(-not(Test-Path $path))
        {
            ThrowError -errorMessage $msDeployNotFoundError 
        }
    }
    catch
    {
        ThrowError -errorMessage $msDeployNotFoundError
    }

    return $path
}

$webDeployPackage = $webDeployPackage.Trim()
$webDeployParamFile = $webDeployParamFile.Trim()
$overRideParams = $overRideParams.Trim()

$msDeployLocation = Get-MsDeployLocation
$msDeployExe = Join-Path $msDeployLocation msDeploy.exe
$msDeployCmdArgs = ""

if(-not [string]::IsNullOrEmpty($webDeployParamFile) -and $webDeployParamFile -ne "`"`"")
{    
    $msDeployCmdArgs = [string]::Format(' -setParamFile={0}', $webDeployParamFile)
}

if(-not [string]::IsNullOrEmpty($overRideParams) -and $overRideParams -ne "`"`"")
{
    $msDeployCmdArgs = [string]::Format("{0} -setParam:{1}", $msDeployCmdArgs, $overRideParams)
}

$msDeployCmdArgs = [string]::Format(' -verb:sync -source:package={0} {1} -dest:auto -verbose -retryAttempts:3 -retryInterval:3000', $webDeployPackage, $msDeployCmdArgs)

$msDeployCmd = "`"$msDeployExe`" $msDeployCmdArgs"
Write-Verbose "Executing MSDeploy Command: $msDeployCmd" -Verbose
cmd.exe /c "`"$msDeployCmd`""