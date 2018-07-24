function Publish-Telemetry
{
    Param (
        [String]
        $TaskName,

        [String]
        $OperationId,

        [System.Management.Automation.ErrorRecord]
        $ErrorData
    )

    try
    {
        $telemetryData = @{
            'OperationId'   = $OperationId
            'ExceptionData' = (Get-ExceptionData $ErrorData)
            'JobId' = (Get-VstsTaskVariable -Name 'System.JobId')
        }

        $telemetryJson = ConvertTo-Json $telemetryData -Compress
        Write-Host "##vso[telemetry.publish area=TaskHub;feature=$TaskName]$telemetryJson"
    }
    catch
    {
        # suppress
        Write-Warning (Get-VstsLocString -Key TelemetryWarning -ArgumentList $_)
    }
}

function Get-ExceptionData
{
    param(
        [System.Management.Automation.ErrorRecord]
        $error
    )

    $exceptionData = ""
    try
    {
        $src = $error.InvocationInfo.PSCommandPath + "|" + $error.InvocationInfo.ScriptLineNumber
        $exceptionTypes = ""

        $exception = $error.Exception
        if ($exception.GetType().Name -eq 'AggregateException')
        {
            $flattenedException = ([System.AggregateException]$exception).Flatten()
            $flattenedException.InnerExceptions | ForEach-Object {
                $exceptionTypes += $_.GetType().FullName + ";"
            }
        }
        else
        {
            do
            {
                $exceptionTypes += $exception.GetType().FullName + ";"
                $exception = $exception.InnerException
            } while ($exception -ne $null)
        }
        $exceptionData = "$exceptionTypes|$src"
    }
    catch
    {}

    return $exceptionData
}