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

function New-SqlBatchFilesDestDirectory
{
    param (
        [string]$directoryName
    )

    if ((Test-Path -Path $directoryName) -eq $true) 
    {
        
        Get-ChildItem -Path $directoryName -Force -Recurse |
            Sort-Object -Property FullName -Descending |
            Remove-Item -Recurse -Force | Out-Null

        Remove-Item -Path $directoryName -Force | Out-Null
    }

    New-Item -Path $directoryName -ItemType Directory | Out-Null
}

$taskType = Get-VstsInput -Name "TaskType" -Require
$dacpacFile = Get-VstsInput -Name "dacpacFile"
$sqlFiles = Get-VstsInput -Name "sqlFile" 
$executeInTransaction = Get-VstsInput -Name "ExecuteInTransaction" -AsBool
$exclusiveLock = Get-VstsInput -Name "ExclusiveLock" -AsBool
$appLockName = Get-VstsInput -Name "AppLockName" 
$inlineSql = Get-VstsInput -Name "inlineSql"
$targetMethod = Get-VstsInput -Name "targetMethod"
$serverName = Get-VstsInput -Name "serverName"
$databaseName = Get-VstsInput -Name "databaseName"
$authscheme = Get-VstsInput -Name "authscheme"
$sqlUsername = Get-VstsInput -Name "sqlUsername"
$sqlPassword = Get-VstsInput -Name "sqlPassword"
$connectionString = Get-VstsInput -Name "connectionString"
$publishProfile = Get-VstsInput -Name "publishProfile"
$additionalArguments = Get-VstsInput -Name "additionalArguments"
$additionalArgumentsSql = Get-VstsInput -Name "additionalArgumentsSql"


Import-Module $PSScriptRoot\ps_modules\TaskModuleSqlUtility
. "$PSScriptRoot\Utility.ps1"
. "$PSScriptRoot\GenerateSqlBatchFiles.ps1"

# Telemetry for SQL Dacpac deployment on machine group
$encodedServerName = GetSHA256String($serverName)
$encodedDatabaseName = GetSHA256String($databaseName)
$telemetryJsonContent = -join("{`"serverName`": `"$encodedServerName`",",
                              "`"databaseName`": `"$encodedDatabaseName`"}")
Write-Host "##vso[telemetry.publish area=SqlDacpacDeploymentOnMachineGroup;feature=SqlDacpacDeploymentOnMachineGroup]$telemetryJsonContent"

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
        Invoke-DacpacDeployment -dacpacFile $dacpacFile -targetMethod $targetMethod -serverName $serverName -databaseName $databaseName -authscheme $authscheme -sqlServerCredentials $sqlServerCredentials -connectionString $connectionString -publishProfile $publishProfile -additionalArguments $additionalArguments
    }
    else
    {
        if ($taskType -eq "sqlQuery")
        {
            if ($executeInTransaction)
            {
                if ($exclusiveLock -and ($appLockName.Length -eq 0))
                {
                    Write-Error "Invalid Applock name. exclusiveLock: $exclusiveLock, appLockName: $appLockName"
                }
                
                $batch = 1
                $destPath = [System.IO.Path]::Combine($env:SYSTEM_DEFAULTWORKINGDIRECTORY, "batchdir")
                New-SqlBatchFilesDestDirectory -directoryName $destPath

                $sqlScriptsWithExpandedPath = ""
                $sqlScriptFiles = $sqlFiles -split ";"
                foreach ($sqlScript in $sqlScriptFiles) 
                {
                    $sqlScript = $sqlScript.Trim()
                    if (-not [string]::IsNullOrEmpty($sqlScript)) 
                    {
                        $sqlScript = Get-SingleFile -pattern $sqlScript
                        $batchFiles = Create-BatchFilesForSqlFile -sqlFilePath $sqlScript -destPath $destPath -batch $batch
                        $sqlScriptsWithExpandedPath = $sqlScriptsWithExpandedPath + $batchFiles + "; "
                        $batch = [int]$batch + 1
                    }
                }
                Write-Verbose "Executing sql scripts $sqlScriptsWithExpandedPath under transaction using app lock $appLockName"
                Invoke-SqlScriptsInTransaction -serverName $serverName -databaseName $databaseName -appLockName $appLockName -sqlscriptFiles $sqlScriptsWithExpandedPath -authscheme $authscheme -sqlServerCredentials $sqlServerCredentials -additionalArguments $additionalArguments

                if ($env:system_debug -eq $false)
                {
                    #Leave the batch files if in debug mode. Remove otherwise.
                    Get-ChildItem -Path $destPath -Force -Recurse |
                        Sort-Object -Property FullName -Descending |
                        Remove-Item -Recurse -Force | Out-Null
                    Remove-Item -Path $destPath -Force
                }
                
            } 
            else 
            {
                $sqlScriptFiles = $sqlFiles -split ";"
                foreach ($sqlScript in $sqlScriptFiles) 
                {
                    $sqlScript = $sqlScript.Trim()
                    if (-not [string]::IsNullOrEmpty($sqlScript)) 
                    {
                        $sqlScript = Get-SingleFile -pattern $sqlScript
                        Invoke-SqlQueryDeployment -taskType $taskType -sqlFile $sqlScript -serverName $serverName -databaseName $databaseName -authscheme $authscheme -sqlServerCredentials $sqlServerCredentials -additionalArguments $additionalArguments
                    }
                }
            }
        }
        else 
        {
            Invoke-SqlQueryDeployment -taskType $taskType -inlineSql $inlineSql -serverName $serverName -databaseName $databaseName -authscheme $authscheme -sqlServerCredentials $sqlServerCredentials -additionalArguments $additionalArguments
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
