Trace-VstsEnteringInvocation $MyInvocation
Import-VstsLocStrings "$PSScriptRoot\Task.json"

function Write-Exception
{
    param (
        $exception
    )

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

function Get-SingleFile
{
    param (
        [string]$pattern
    )

    Write-Verbose "Finding files with pattern $pattern"
    $files = Find-VstsFiles -LegacyPattern "$pattern"
    Write-Verbose "Matched files = $files"

    if ($files -is [system.array])
    {
        throw (Get-VstsLocString -Key "Foundmorethanonefiletodeploywithsearchpattern0Therecanbeonlyone" -ArgumentList $pattern)
    }
    else
    {
        if (!$files)
        {
            throw (Get-VstsLocString -Key "Nofileswerefoundtodeploywithsearchpattern0" -ArgumentList $pattern)
        }
        return $files
    }
}

$taskType = Get-VstsInput -Name "TaskType" -Require
$dacpacFile = Get-VstsInput -Name "dacpacFile"
$sqlFile = Get-VstsInput -Name "sqlFile" 
$inlineSql = Get-VstsInput -Name "inlineSql"
$targetMethod = Get-VstsInput -Name "targetMethod"
$serverName = Get-VstsInput -Name "serverName" -Require
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
        $dacpacFile = Get-SingleFile -pattern $dacpacFile
        Execute-DacpacDeployment -dacpacFile $dacpacFile -targetMethod $targetMethod -serverName $serverName -databaseName $databaseName -authscheme $authscheme -sqlServerCredentials $sqlServerCredentials -connectionString $connectionString -publishProfile $publishProfile -additionalArguments $additionalArguments
    }
    else
    {

        $connectionString = Escape-SpecialChars -str $connectionString
        $sqlPassword = Escape-SpecialChars -str $sqlPassword
        $additionalArguments = Escape-SpecialChars -str $additionalArguments
        $databaseName = Escape-SpecialChars -str $databaseName
        if ($taskType -eq "sqlQuery")
        {
            $sqlFile = Get-SingleFile -pattern $sqlFile
        Execute-SqlQueryDeployment -taskType $taskType -sqlFile $sqlFile -serverName $serverName -databaseName $databaseName -authscheme $authscheme -sqlServerCredentials $sqlServerCredentials -additionalArguments $additionalArguments
        }
        else 
        {
            Execute-SqlQueryDeployment -taskType $taskType -inlineSql $inlineSql -serverName $serverName -databaseName $databaseName -authscheme $authscheme -sqlServerCredentials $sqlServerCredentials -additionalArguments $additionalArguments
        }
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
