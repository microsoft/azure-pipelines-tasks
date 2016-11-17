Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

$taskType = Get-VstsInput -Name "TaskType" -Require
$dacpacFile = Get-VstsInput -Name "dacpacFile"
$sqlFile = Get-VstsInput -Name "sqlFile" 
$inlineSql = Get-VstsInput -Name "inlineSql"
$targetMethod = Get-VstsInput -Name "targetMethod"
$databaseName = Get-VstsInput -Name "databaseName" -Require
$authscheme = Get-VstsInput -Name "authscheme" -Require
$sqlUsername = Get-VstsInput -Name "sqlUsername"
$sqlPassword = Get-VstsInput -Name "sqlPassword"
$connectionString = Get-VstsInput -Name "connectionString"
$publishProfile = Get-VstsInput -Name "publishProfile"
$additionalArguments = Get-VstsInput -Name "additionalArguments"
$additionalArgumentsSql = Get-VstsInput -Name "additionalArgumentsSql"

Import-Module $PSScriptRoot\ps_modules\TaskModuleSqlUtility

Try
{
    $connectionString = Escape-SpecialChars -str $connectionString
    $sqlPassword = Escape-SpecialChars -str $sqlPassword
    $additionalArguments = Escape-SpecialChars -str $additionalArguments
    $databaseName = Escape-SpecialChars -str $databaseName
    $serverName = "localhost"
    if ($taskType -ne "dacpac")
    {
        $additionalArguments = $additionalArgumentsSql
        $targetMethod = "server"
    }
    if ($taskType -eq "dacpac")
    {
        if ([System.IO.Path]::GetExtension($dacpacFile) -ne ".dacpac")
        {
            throw "Invalid Dacpac file [ $dacpacFile ] provided"
        }

        Execute-DacpacDeployment -dacpacFile $dacpacFile -targetMethod $targetMethod -serverName $serverName -databaseName $databaseName -authscheme $authscheme -sqlUsername $sqlUsername -sqlPassword $sqlPassword -connectionString $connectionString -publishProfile $publishProfile -additionalArguments $additionalArguments
    }
    else
    {
        Execute-SqlQueryDeployment -taskType $taskType -sqlFile $sqlFile -inlineSql $inlineSql -serverName $serverName -databaseName $databaseName -authscheme $authscheme -sqlUsername $sqlUsername -sqlPassword $sqlPassword -additionalArguments $additionalArguments
    }

}
Catch [System.Management.Automation.CommandNotFoundException]
{
    if ($_.Exception.CommandName -ieq "Invoke-Sqlcmd")
    {
        Write-Output "SQL Powershell Module is not installed on your agent machine. Please follow steps given below to execute this task"  -ForegroundColor Red
        Write-Output "1. Install PowershellTools & SharedManagementObjects(dependency), from https://www.microsoft.com/en-us/download/details.aspx?id=52676 (2016)"
        Write-Output "2. Restart agent machine after installing tools to register Module path updates"
        Write-Output "3. Run Import-Module SQLPS on your agent Powershell prompt. (This step is not required on Powershell 3.0 enabled machines)"
    }

    Write-Error ($_.Exception|Format-List -Force|Out-String)
    throw
}
Catch [Exception]
{
    Write-Error ($_.Exception|Format-List -Force|Out-String)
    throw
}
Finally
{
    # Delete Temp file Created During inline Task Execution
    if ($taskType -eq "inlineSql" -and (Test-Path $FilePath) -eq $true)
    {
        Write-Verbose "Removing File $FilePath"
        Remove-Item $FilePath -ErrorAction 'SilentlyContinue'
    }
}
