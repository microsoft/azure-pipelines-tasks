function Invoke-ActionWithRetries {
    [CmdletBinding()]
    param(
        [scriptblock]
        $Action,

        [scriptblock]
        $ActionSuccessValidator = { $true },

        [int32]
        $MaxTries = 10,

        [int32]
        $RetryIntervalInSeconds = 1,

        [string[]]
        [ValidateScript({[System.Exception].IsAssignableFrom([type]$_)})]
        $RetryableExceptions,

        [string]
        $RetryMessage
    )

    Trace-VstsEnteringInvocation $MyInvocation

    if(!$RetryMessage)
    {
        $RetryMessage = Get-VstsLocString -Key RetryAfterMessage $RetryIntervalInSeconds
    }

    $retryIteration = 1
    do
    {
        $result = $false
        $exception = $null

        try
        {
            $result = & $Action
        }
        catch
        {
            if(($null -eq $RetryableExceptions) -or (Test-RetryableException -Exception $_.Exception -AllowedExceptions $RetryableExceptions))
            {
                $exception = $_.Exception
            }
            else
            {
                throw
            }
        }

        if(!$exception -and (!$result -or $ActionSuccessValidator.Invoke($result)))
        {
            return $result
        }

        if($retryIteration -eq $MaxTries)
        {
            if($exception)
            {
                throw $exception
            }
            else
            {
                throw (Get-VstsLocString -Key ActionTimedOut)
            }
        }

        Write-Host $RetryMessage
        $retryIteration++
        Start-Sleep $RetryIntervalInSeconds
    } while ($true)

    Trace-VstsLeavingInvocation $MyInvocation
}

function Test-RetryableException {
    [CmdletBinding()]
    param(
        [System.Object]
        $Exception,

        [string[]]
        $AllowedExceptions
    )

    $AllowedExceptions | ForEach-Object {
        if($_ -and ($Exception -is ([type]$_)))
        {
            return $true;
        }
    }

    return $false
}