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

function Write-Exception($exception)
{
    if($exception.Message) 
    {
        Write-Error ($exception.Message)
    }
    else 
    {
        Write-Error ($exception)
    }
    throw
}

Try
{
    $serverName = "localhost"
    if ($taskType -ne "dacpac")
    {
        $additionalArguments = $additionalArgumentsSql
        $targetMethod = "server"
    }

    if($sqlUsername -and $sqlPassword)
    {
        $secureAdminPassword = "$sqlPassword" | ConvertTo-SecureString  -AsPlainText -Force
        $sqlServerCredentials = New-Object System.Management.Automation.PSCredential ("$sqlUserName", $secureAdminPassword)
    }

    if ($taskType -eq "dacpac")
    {
        Execute-DacpacDeployment -dacpacFile $dacpacFile -targetMethod $targetMethod -serverName $serverName -databaseName $databaseName -authscheme $authscheme -sqlServerCredentials $sqlServerCredentials -connectionString $connectionString -publishProfile $publishProfile -additionalArguments $additionalArguments
    }
    else
    {
        $connectionString = Escape-SpecialChars -str $connectionString
        $sqlPassword = Escape-SpecialChars -str $sqlPassword
        $additionalArguments = Escape-SpecialChars -str $additionalArguments
        $databaseName = Escape-SpecialChars -str $databaseName
        Execute-SqlQueryDeployment -taskType $taskType -sqlFile $sqlFile -inlineSql $inlineSql -serverName $serverName -databaseName $databaseName -authscheme $authscheme -sqlServerCredentials $sqlServerCredentials -additionalArguments $additionalArguments
    }

}
Catch [System.Management.Automation.CommandNotFoundException]
{
    if ($_.Exception.CommandName -ieq "Invoke-Sqlcmd")
    {
        Write-Error (Get-VstsLocString -Key "SQLPowershellModuleisnotinstalledonyouragentmachine")
        Write-Error (Get-VstsLocString -Key "InstallPowershellToolsharedManagementObjectsdependency")
        Write-Error (Get-VstsLocString -Key "RestartagentmachineafterinstallingtoolstoregisterModulepathupdates")
        Write-Error (Get-VstsLocString -Key "RunImportModuleSQLPSonyouragentPowershellprompt")
    }

    Write-Exception($_.Exception)
}
Catch [Exception]
{
    Write-Exception($_.Exception)
}
