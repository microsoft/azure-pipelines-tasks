Import-Module Microsoft.PowerShell.Security
Import-Module $PSScriptRoot\ps_modules\VstsTaskSdk

function Get-VstsFederatedTokenPS2Task {
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

    $headers = @{
        "Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$($vstsAccessToken)"))
        "Content-Type"  = "application/json"
    }
    
    # POST request to generate the OIDC token
    $response = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -Body $body
    $responseContent = $response.Content | ConvertFrom-Json
    $oidcToken = $responseContent.oidcToken

    if ($null -eq $oidcToken -or $oidcToken -eq [string]::Empty) {
        throw (New-Object System.Exception("CouldNotGenerateOidcToken"))
    }
    
    return $oidcToken
}

function Get-WiscAccessTokenPSV2Task {
    param(
        $taskDict
    )

    $clientId = $taskDict["ClientId"]
    $envAuthUrl = $taskDict["EnvAuthUrl"]
    $tenantId = $taskDict["TenantId"]
    $vstsAccessToken = $taskDict["VstsAccessToken"]

    Add-Type -Path "$PSScriptRoot\ps_modules\VstsAzureRestHelpers_\msal\Microsoft.Identity.Client.dll"

    $clientBuilder = [Microsoft.Identity.Client.ConfidentialClientApplicationBuilder]::Create($clientId).WithAuthority($envAuthUrl, $tenantId)

    $oidc_token = Get-VstsFederatedTokenPS2Task -taskDict $taskDict -vstsAccessToken $vstsAccessToken
    $msalClientInstance = $clientBuilder.WithClientAssertion($oidc_token).Build()

    $scope = "499b84ac-1321-427f-aa17-267ca6975798"
    [string] $resourceId = $scope + "/.default"
    $scopes = [Collections.Generic.List[string]]@($resourceId)

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

# This is the main tokenHandler object
# It is responsible for handling the access token requests for input ADO service connection received from User script via Get-AzDoToken

# $filePath : Shared file between user script and task script. The generated token is written to this file. The file is access controlled.
# $signalFromUserScript : Name of the event received from user script via Get-AzDoToken indicating a token request
# $signalFromTask : Name of the event sent by TokenHandler to Get-AzDoToken indicating the token is generated and ready to be read from the shared file.
# $exitSignal : Name of the event sent by the Main runspace of the taskScript to the token handler indicating the end of the task and exit.
# $taskDict : Pre-Fetched values from the main runspace required for token generation
# $waitSignal : Name of the event sent by the Main runspace of the taskScript to the token handler to verify if the token handler is ready to handle request.
# sharedVar : It is an env var. When TokenHandler is ready & a wait signal is received, it will set this env var $sharedVar to "start" from "wait"

# The run method 
# First creates the shared file with path value equal to $filePath and set the access control restricted to current user only.
# Runs an infinite loop, inside that it listens to the various signals/events received from user script and the main runspace of task script.
# eventFromUserScript : It indicates an event from user script requesting token
# eventTaskWaitToExecute : It indicates an event from main task runspace to set the Env Var $sharedVar to "start" from "wait"
# exitSignal : It indicates an event from main task runspace to break the infinite loop and exit.
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
                Set-Acl -Path $filePath -AclObject $acl
            } 
            else 
            {
                throw "Token File not found"
            }

            # Infinite loop to wait for and handle signals from user script for token request
            while ($true) 
            {
                try 
                {
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
                        }
                        catch 
                        {
                            $result["ExceptionMessage"] = $_
                        } 
                        finally 
                        {
                            $json = $result | ConvertTo-Json
                            $json | Set-Content -Path $filePath
                        }

                        # Signal UserScript to read the file
                        $res = $eventFromTask.Set()

                    } 
                    elseif ($index -eq 1) {
                        [System.Environment]::SetEnvironmentVariable($sharedVar, "start", [System.EnvironmentVariableTarget]::Process)
                    }
                    elseif ($index -eq 2) 
                    {
                        # Exit signal received
                        break
                    }
                } 
                catch 
                {
                    # do nothing
                }
            }
        } 
        finally 
        {
            try 
            {
                if ($null -ne $eventFromUserScript ) { $eventFromUserScript.Dispose() }
                if ($null -ne $eventFromTask) { $eventFromTask.Dispose() }
                if ($null -ne $eventExit) { $eventExit.Dispose() }
            } 
            catch 
            {
                # do nothing
            }
        }
    }
}