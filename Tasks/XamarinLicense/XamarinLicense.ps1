param(
    [string]$action, 
    [string]$email, 
    [string]$password,
    [string]$activateAndroid,
    [string]$timeout 
)

Write-Verbose "Entering script XamarinLicense.ps1"
Write-Verbose "action = $action"
Write-Verbose "email = $email"
Write-Verbose "activateAndroid = $activateAndroid"
Write-Verbose "timeout = $timeout"

$activateAndroidLicense = Convert-String $activateAndroid Boolean
Write-Verbose "activateAndroid (converted) = $activateAndroidLicense"

# Import the Task.Common dll that has all the cmdlets we need for Build
import-module "Microsoft.TeamFoundation.DistributedTask.Task.Common"

if (!$action)
{
    throw "Action parameter not set on script"
}

if (!$email)
{
    throw "Email parameter not set on script"
}

if (!$password)
{
    throw "Password parameter not set on script"
}

$timeoutInSec = $null
if (![Int32]::TryParse($timeout, [ref] $timeoutInSec))
{
    Write-Verbose "Could not parse timeout input, timeout default to 30 seconds."
    $timeoutInSec = 30
}
Write-Verbose "timeout: $timeoutInSec"

if ($action -eq "activate")
{
    $xamarinProducts = @()
    if ($activateAndroidLicense)
    {
        $xamarinProducts += [Microsoft.TeamFoundation.DistributedTask.Task.Common.Core.XamarinProductType]::Android 
    }

    foreach ($p in $xamarinProducts)
    {
        Write-Verbose "Activating license for product type $p"
        Register-XamarinLicense -Email $email -Password $password -Product $p -TimeoutInSec $timeoutInSec
    }
}
elseif ($action -eq "deactivate")
{
    Unregister-XamarinLicense -Email $email -Password $password -TimeoutInSec $timeoutInSec
}

Write-Verbose "Leaving script XamarinLicense.ps1"
