Import-Module Microsoft.PowerShell.Security
Import-Module $PSScriptRoot\ps_modules\VstsTaskSdk

$tokenHandler = [PSCustomObject]@{

    Run = {
        param(
            [Parameter(Mandatory=$true)]
            [string]$pipeName,
            [Parameter(Mandatory=$true)]
            $taskDict
        )

        $pipe = $null
        $reader = $null

        try 
        {
            $pipe = New-Object System.IO.Pipes.NamedPipeServerStream("$pipeName","InOut")
            
            $env:praval = $env:praval + "`n" + "Waiting for a connection..."
            $env:startTask = "true"

            $timeout = [timespan]::FromSeconds(10)
            $source = [System.Threading.CancellationTokenSource]::new($timeout)
            $conn = $pipe.WaitForConnectionAsync($source.token)
            do {
                # some other stuff here while waiting for connection
                Start-Sleep 1
            } until ($conn.IsCompleted)
            
            # $pipe.WaitForConnection() # Use WaitForConnectionAsync
            $env:praval = $env:praval + "`n" + "Client connected."

            $reader = New-Object System.IO.StreamReader($pipe)
            $writer = New-Object System.IO.StreamWriter($pipe)
            
            # Infinite loop to wait for requests and respond
            while ($true) {
                $result = @{
                    Token = $null
                    Expiration = $null
                    ErrorMessage = $null
                }

                try 
                {    
                    $env:praval = $env:praval + "`n" + "Listening"
                    $line = $reader.ReadLine() # Use a thread with timeout
                    if ($null -eq $line) { break }
                    if ($line -eq "Stop-Pipe") { break }
                    $env:praval = $env:praval + "`n" + "Received input $line"
                    $result = Get-WiscAccessTokenPSV2Task -taskDict $taskDict  
                    $env:praval = $env:praval + "`n" + "Successfully generated the Azure Access token for Service Connection"
                    break
                } 
                catch 
                {
                    $result["ErrorMessage"] = $_
                    $env:praval = $env:praval + "`n" + "Error occurred while waiting for signals: $_"
                }
                finally 
                {
                    $outputString = $result | ConvertTo-Json
                   
                    $writer.WriteLine($outputString)
                    $writer.Flush()
                }
            }
        } 
        catch 
        {
            $env:praval = $env:praval + "`n" + "Error in Task Execution: $_"
        } 
        finally 
        {
            try 
            {
                if($null -ne $reader) { $reader.Dispose() }
                if($null -ne $writer) { $writer.Dispose() }
                if($null -ne $pipe) { $pipe.Dispose() }
            } 
            catch 
            {
                $env:praval = $env:praval + "`n" + "Error in Task Cleanup: $_"
            }
        }
    }
}

function Global:Get-WiscAccessTokenPSV2Task {
    param(
        $taskDict
    )
    $env:praval = $env:praval + "`n" + "Inside Get-WiscAccessTokenPSV2"

    $clientId = $taskDict["ClientId"]
    $envAuthUrl = $taskDict["EnvAuthUrl"]
    $tenantId = $taskDict["TenantId"]
    $connectedServiceName = $taskDict["ConnectedServiceName"]
    $vstsAccessToken = $taskDict["VstsAccessToken"]

    Add-Type -Path "$PSScriptRoot\msal\Microsoft.Identity.Client.dll"
    $clientBuilder = [Microsoft.Identity.Client.ConfidentialClientApplicationBuilder]::Create($clientId).WithAuthority($envAuthUrl, $tenantId)

    $oidc_token = Get-VstsFederatedToken -serviceConnectionId $connectedServiceName -vstsAccessToken $vstsAccessToken
    $env:praval = $env:praval + "`n" + "oidc_token $oidc_token"
    $msalClientInstance = $clientBuilder.WithClientAssertion($oidc_token).Build()

    $scope = "499b84ac-1321-427f-aa17-267ca6975798"
    [string] $resourceId = $scope + "/.default"
    $scopes = [Collections.Generic.List[string]]@($resourceId)

    $env:praval = $env:praval + "`n" + "Fetching Access Token - MSAL"
    $tokenResult = $msalClientInstance.AcquireTokenForClient($scopes).ExecuteAsync().GetAwaiter().GetResult()

    $token = $null
    $expirationTime = $null
    if($tokenResult) {
        $token = $tokenResult.AccessToken
        $expirationTime = $([math]::Round(([DateTime]::Parse($tokenResult.ExpiresOn) - [DateTime]::Now).TotalMinutes))
    }

    if ($null -eq $token -or $token -eq [string]::Empty) {
        $env:praval = $env:praval + "`n" + "Generated token found to be null, returning the System Access Token"
    } else {
        $env:praval = $env:praval + "`n" + "Successfully generated the Azure Access token for Service Connection : $connectedServiceName"   
    }

    return @{
        Token = $token
        Expiration = $expirationTime
    }
}
New-Alias -Name 'Get-WiscAccessTokenPSV2Task' -Value 'Global:Get-WiscAccessTokenPSV2Task' -Scope Global

function Global:Get-VstsFederatedTokenPS2Task {
    param(
        [Parameter(Mandatory=$true)]
        [string]$serviceConnectionId,
        [Parameter(Mandatory=$true)]
        [string]$vstsAccessToken
    )

    #Pass these values as input to the runspace
    $uri = Get-VstsTaskVariable -Name 'System.CollectionUri' -Require
    $planId = Get-VstsTaskVariable -Name 'System.PlanId' -Require
    $jobId = Get-VstsTaskVariable -Name 'System.JobId' -Require
    $hub = Get-VstsTaskVariable -Name 'System.HostType' -Require
    $projectId = Get-VstsTaskVariable -Name 'System.TeamProjectId' -Require

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
