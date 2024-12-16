Import-Module Microsoft.PowerShell.Security
Import-Module $PSScriptRoot\ps_modules\VstsTaskSdk

function Global:Get-VstsFederatedTokenPS2Task {
    param(
        [Parameter(Mandatory=$true)]
        $taskDict,
        [Parameter(Mandatory=$true)]
        [string]$vstsAccessToken
    )

    $serviceConnectionId = $taskDict["ConnectedServiceName"] 
    $uri = $taskDict["Uri"] 
    $planId = $taskDict["PlanId"]
    $jobId = $taskDict["JobId"]
    $hub = $taskDict["Hub"]
    $projectId = $taskDict["ProjectId"]

    $url = $uri + "$projectId/_apis/distributedtask/hubs/$hub/plans/$planId/jobs/$jobId/oidctoken?serviceConnectionId=$serviceConnectionId&api-version=7.1-preview.1"
    $env:praval = $env:praval + "`n" + $url

    $headers = @{
        "Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$($vstsAccessToken)"))
        "Content-Type"  = "application/json"
    }
    
    # POST request to generate the OIDC token
    $response = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -Body $body

    # Parse the response content to extract the OIDC token
    $responseContent = $response.Content | ConvertFrom-Json
    $oidcToken = $responseContent.oidcToken

    if ($null -eq $oidcToken -or $oidcToken -eq [string]::Empty) {
        $env:praval = $env:praval + "`n" + "Failed to create OIDC token."
        throw (New-Object System.Exception("CouldNotGenerateOidcToken"))
    }
    
    $env:praval = $env:praval + "`n" + "OIDC Token generated Successfully"
    return $oidcToken
}
New-Alias -Name 'Get-VstsFederatedToken' -Value 'Global:Get-VstsFederatedTokenPS2Task' -Scope Global

function Global:Get-WiscAccessTokenPSV2Task {
    param(
        $taskDict
    )

    $clientId = $taskDict["ClientId"]
    $envAuthUrl = $taskDict["EnvAuthUrl"]
    $tenantId = $taskDict["TenantId"]
    $connectedServiceName = $taskDict["ConnectedServiceName"]
    $vstsAccessToken = $taskDict["VstsAccessToken"]

    $env:praval = $env:praval + "`n" + $a

    Add-Type -Path "$PSScriptRoot\ps_modules\VstsAzureRestHelpers_\msal\Microsoft.Identity.Client.dll"

    $clientBuilder = [Microsoft.Identity.Client.ConfidentialClientApplicationBuilder]::Create($clientId).WithAuthority($envAuthUrl, $tenantId)

    $oidc_token = Get-VstsFederatedToken -taskDict $taskDict -vstsAccessToken $vstsAccessToken
    $env:praval = $env:praval + "`n" + "oidc_token $oidc_token"
    $msalClientInstance = $clientBuilder.WithClientAssertion($oidc_token).Build()

    $scope = "499b84ac-1321-427f-aa17-267ca6975798"
    [string] $resourceId = $scope + "/.default"
    $scopes = [Collections.Generic.List[string]]@($resourceId)

    $env:praval = $env:praval + "`n" + "Fetching Access Token - MSAL"
    $tokenResult = $msalClientInstance.AcquireTokenForClient($scopes).ExecuteAsync().GetAwaiter().GetResult()

    $result = @{
        Token = $null
        ExpirationPeriod = $null
        ExceptionMessage = $null
    }

    if($tokenResult) {
        $result["Token"] = $tokenResult.AccessToken
        $result["ExpirationPeriod"] = $([math]::Round(([DateTime]::Parse($tokenResult.ExpiresOn) - [DateTime]::Now).TotalMinutes))
    }
    
    return $result
}
New-Alias -Name 'Get-WiscAccessTokenPSV2Task' -Value 'Global:Get-WiscAccessTokenPSV2Task' -Scope Global

$tokenHandler = [PSCustomObject]@{

    Run = {
        param(
            [Parameter(Mandatory=$true)]
            [string]$filePath,
            [Parameter(Mandatory=$true)]
            [string]$signalFromUserScript,
            [Parameter(Mandatory=$true)]
            [string]$signalFromTask,
            [Parameter(Mandatory=$true)]
            [string]$exitSignal,
            [Parameter(Mandatory=$true)]
            $taskDict,
            [Parameter(Mandatory=$true)]
            $waitSignal,
            [Parameter(Mandatory=$true)]
            $sharedVar
        )

        $eventFromUserScript = $null
        $eventFromTask = $null
        $eventExit = $null
        $eventTaskWaitToExecute = $null

        try {
            $eventFromUserScript = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, $signalFromUserScript)
            $eventFromTask = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, $signalFromTask)
            $eventExit = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, $exitSignal)
            $eventTaskWaitToExecute = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, $waitSignal)

            # Ensure the output file has restricted permissions
            if (-not (Test-Path $filePath)) 
            {
                New-Item -Path $filePath -ItemType File -Force
                $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

                # Create a new ACL that only grants access to the current user
                $acl = Get-Acl $filePath
                $acl.SetAccessRuleProtection($true, $false)  # Disable inheritance
                $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
                    $currentUser, "FullControl", "Allow"
                )
                $acl.SetAccessRule($rule)

                # Apply the ACL to the file
                Set-Acl -Path $filePath -AclObject $acl
            } 
            else 
            {
                $env:praval = $env:praval + "`n" + "Token File not found"
                throw "Token File not found"
            }

            $env:praval = $env:praval + "`n" + "Task: Waiting for signals..."

            # Infinite loop to wait for and handle signals from user script for token request
            while ($true) {
                try {
                    # Wait for either UserScript signal or Exit signal
                    $index = [System.Threading.WaitHandle]::WaitAny(@($eventFromUserScript, $eventTaskWaitToExecute, $eventExit))

                    if ($index -eq 0) 
                    {

                        # Signal from UserScript
                        $result = @{
                            Token = $null
                            ExpirationPeriod = $null
                            ExceptionMessage = $null
                        }

                        try 
                        {
                            $result = Get-WiscAccessTokenPSV2Task -taskDict $taskDict  
                            $env:praval = $env:praval + "`n" + "Successfully generated the Azure Access token for Service Connection"           
                        }
                        catch 
                        {
                            $env:praval = $env:praval + "`n" + "Failed to generate token with message $_"
                            $result["ExceptionMessage"] = $_
                        } 
                        finally 
                        {
                            $json = $result | ConvertTo-Json
                            $json | Set-Content -Path $filePath
                            $env:praval = $env:praval + "`n" + "Task: Wrote access token to file"
                        }

                        # Signal UserScript to read the file
                        $res = $eventFromTask.Set()

                    } 
                    elseif ($index -eq 1) {
                        [System.Environment]::SetEnvironmentVariable($sharedVar, "start", [System.EnvironmentVariableTarget]::Process)
                        $env:praval = $env:praval + "`n" + "SharedDict Set" 
                    }
                    elseif ($index -eq 2) 
                    {
                        $env:praval = $env:praval + "`n" + "Exiting the loop"
                        # Exit signal received
                        break
                    }
                } catch {
                    $env:praval = $env:praval + "`n" + "Error occurred while waiting for signals: $_"
                }
            }
        } catch {
            $env:praval = $env:praval + "`n" + "Critical error in Task: $_"
        } finally {
            try {
                if ($null -ne $eventFromUserScript ) { $eventFromUserScript.Dispose() }
                if ($null -ne $eventFromTask) { $eventFromTask.Dispose() }
                if ($null -ne $eventExit) { $eventExit.Dispose() }
            } catch {
                # do nothing
            }
        }
    }
}