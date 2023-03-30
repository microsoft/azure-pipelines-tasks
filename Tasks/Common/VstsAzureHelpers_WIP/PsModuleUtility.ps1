function Update-PSModulePathForHostedAgentWithLatestModule
{
    [CmdletBinding()]
    param(
        [object] $Endpoint
    )
    
    Trace-VstsEnteringInvocation $MyInvocation
    try
    {
        $authenticationScheme = $Endpoint.Auth.Scheme

        if ($authenticationScheme -eq "ServicePrincipal" -or
            $authenticationScheme -eq "ManagedServiceIdentity")
        {
            Write-Verbose "Updating PSModulePath with latest AzureRM module."
            $latestAzureRmModulePath = Get-LatestAzureRmModulePath
            
            if (![string]::IsNullOrEmpty($latestAzureRmModulePath))
            {
                $env:PSModulePath = "$latestAzureRmModulePath;$env:PSModulePath"
            }
            else
            {
                Write-Verbose "Latest AzureRM module path is null or empty."
            }
        }
       
    } 
    finally 
    {
        Write-Verbose "The updated value of the PSModulePath is: $($env:PSModulePath)"
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-LatestAzureRmModulePath
{
    [CmdletBinding()]
    param()

    Trace-VstsEnteringInvocation $MyInvocation
    $hostedAgentAzureModulesPath = Join-Path -Path $env:SystemDrive -ChildPath "modules"
    $latestAzureRmModulePath = ""
    try 
    {
        if ($(Test-Path $hostedAgentAzureModulesPath))
        {
            $regexToMatch = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList "^azurerm_[0-9]+\.[0-9]+\.[0-9]+$"
            $regexToExtract = New-Object -TypeName System.Text.RegularExpressions.Regex -ArgumentList "[0-9]+\.[0-9]+\.[0-9]+$"
            $maxVersion = [version] "0.0.0"

            $moduleFolders = Get-ChildItem -Directory -Path $hostedAgentAzureModulesPath | Where-Object { $regexToMatch.IsMatch($_.Name) }

            foreach ($moduleFolder in $moduleFolders) 
            {
                $moduleVersion = [version] $($regexToExtract.Match($moduleFolder.Name).Groups[0].Value)
                
                if ($moduleVersion -gt $maxVersion) 
                {
                    $modulePath = [System.IO.Path]::Combine($moduleFolder.FullName,"AzureRM\$moduleVersion\AzureRM.psm1")
    
                    if (Test-Path -LiteralPath $modulePath -PathType Leaf) 
                    {
                        $maxVersion = $moduleVersion
                        $latestAzureRmModulePath = $moduleFolder.FullName
                    } 
                    else 
                    {
                        Write-Verbose "A folder matching the module folder pattern was found at $($moduleFolder.FullName) but didn't contain a valid module file"
                    }
                }
            }
        }   
        else 
        {
            Write-Verbose "Hosted Agent Azure modules path '$hostedAgentAzureModulesPath' does not exist."
        }

        return $latestAzureRmModulePath
    }
    catch 
    {
        Write-Verbose "Get-LatestAzureRmModulePath: Exception: $($_.Exception.Message)"
        $latestAzureRmModulePath = ""
    }
    finally
    {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}