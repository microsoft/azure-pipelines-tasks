[CmdletBinding(DefaultParameterSetName = 'None')]
param
(
    [String] [Parameter(Mandatory = $true)]
    $ConnectedServiceName,

    [String] [Parameter(Mandatory = $true)]
    $ScriptPath,

    [String] [Parameter(Mandatory = $false)]
    $ScriptArguments
)

function Invoke-Knife()
{
    <#
        .SYNOPSIS
        Returns the output of knife command

        .PARAMETER argumets
        Arguments for knife command
    #>
    [CmdletBinding()]
    Param
    (
        [Parameter(mandatory=$true)]
        [string[]]$arguments
    )

    pushd $global:chefRepo
    try
    {
        $command = "knife "
        $arguments | foreach{ $command += "$_ " }
        $command = $command.Trim()
        Write-verbose "Running knife command: $command" -verbose
        iex $command
    }
    finally
    {
        popd
    }
}

function Setup-ChefRepo()
{
	[CmdletBinding()]
    Param
    (
	[Parameter(mandatory=$true)]
        [string]$connectedServiceName
    )

    Write-Verbose "Creating Chef Repo" -verbose
    $connectedServiceDetails = Get-ConnectedServiceDetails -Context $distributedTaskContext -ConnectedServiceName $connectedServiceName

    [xml]$credentialsXml = $connectedServiceDetails.CredentialsXml
    $userName = $credentialsXml.Credentials.UserName
    Write-Verbose "userName = $userName" -Verbose
    $passwordKey = $credentialsXml.Credentials.PasswordKey
    $organizationUrl = $connectedServiceDetails.EndPoint
    Write-Verbose "organizationUrl = $organizationUrl" -Verbose
    
    #create temporary chef repo
    $randomGuid=[guid]::NewGuid()
    $chefRepoPath = Join-Path -Path $env:temp -ChildPath $randomGuid
    $global:chefRepo = "$chefRepoPath"
    New-Item $chefRepoPath -type Directory | Out-Null

    #create knife config directory
    $knifeConfigDirectoryPath = Join-Path -Path $chefRepoPath -ChildPath ".chef"
    New-Item $knifeConfigDirectoryPath -type Directory | Out-Null

    #create knife.rb
    $knifeConfigPath = Join-Path -Path $knifeConfigDirectoryPath -ChildPath "knife.rb"
    New-Item $knifeConfigPath -type File | Out-Null

    #create passwordKey File
    $privateKeyFileName = $userName + ".pem"
    $privateKeyFilePath = Join-Path -Path $knifeConfigDirectoryPath -ChildPath $privateKeyFileName
    New-Item $privateKeyFilePath -type File -value $passwordKey | Out-Null

    Invoke-Knife @("configure --repository '$chefRepoPath' --server-url '$organizationUrl' --user '$userName' --validation-client-name '$userName'  --validation-key '$privateKeyFileName' --config '$knifeConfigPath' --yes") | Out-Null

    Write-Verbose "Chef Repo Created" -verbose
}

Write-Host "Entering script RunChefPowerShell.ps1"

#ENSURE: We pass arguments verbatim on the command line to the custom script
Write-Host "ScriptArguments= " $ScriptArguments
Write-Host "ScriptPath= " $ScriptPath

$scriptCommand = "$ScriptPath $scriptArguments"
Write-Host "scriptCommand=" $scriptCommand

try
{
    Setup-ChefRepo $connectedServiceName
    Invoke-Expression -Command $scriptCommand
}
finally
{
    #delete temporary chef repo
    if ([string]::IsNullOrEmpty($global:chefRepo) -eq $false)
    {
        Write-Verbose "Deleting Chef Repo" -verbose
        Remove-Item -Recurse -Force $global:chefRepo
        Write-Verbose "Chef Repo Deleted" -verbose
    }
}

Write-Host "Leaving script RunChefPowerShell.ps1"