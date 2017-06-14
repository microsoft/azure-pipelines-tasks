function Invoke-ActionWithRetries {
    [CmdletBinding()]
    param(
        [scriptblock]
        $Action,

        [scriptblock]
        $ActionSuccessValidator = { $true },

        [int32]
        $MaxRetries = 10,

        [int32]
        $RetryIntervalInSeconds = 1,

        [ValidateScript({[System.Exception].IsAssignableFrom([type]$_)})]
        $RetryableException,

        [switch]
        $ContinueOnError = $false,

        [string]
        $RetryMessage
    )

    Trace-VstsEnteringInvocation $MyInvocation

    if($MaxRetries -eq 0)
    {
        $MaxRetries = [Int16]::MaxValue
    }

    if(!$RetryMessage)
    {
        $RetryMessage = Get-VstsLocString -Key RetryAfterMessage $RetryIntervalInSeconds
    }

    $retryIteration = 1
    do 
    {
        $shouldRetry = $false
        $result = $false
        $exception = $null

        try 
        {
            $result = & $Action
        }
        catch 
        {
            if(!$RetryableException -or ($_.Exception.GetType() -eq ([type]$RetryableException)))
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

        $shouldRetry = $true

        if($retryIteration -eq $MaxRetries)
        {
            if(!$ContinueOnError)
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
            else
            {
                return $result
            }
        }

        Write-Host $RetryMessage
        $retryIteration++ 
        Start-Sleep $RetryIntervalInSeconds
    }  while ($shouldRetry -and ($retryIteration -le $MaxRetries))

    Trace-VstsLeavingInvocation $MyInvocation
}