function Global:Get-VstsFederatedTokenPSV2Task {
    param(
        [Parameter(Mandatory=$true)]
        [string]$serviceConnectionId,
        [Parameter(Mandatory=$true)]
        [string]$vstsAccessToken
    )

    $uri = Get-VstsTaskVariable -Name 'System.CollectionUri' -Require
    $planId = Get-VstsTaskVariable -Name 'System.PlanId' -Require
    $jobId = Get-VstsTaskVariable -Name 'System.JobId' -Require
    $hub = Get-VstsTaskVariable -Name 'System.HostType' -Require
    $projectId = Get-VstsTaskVariable -Name 'System.TeamProjectId' -Require

    $url = $uri + "$projectId/_apis/distributedtask/hubs/$hub/plans/$planId/jobs/$jobId/oidctoken?serviceConnectionId=$serviceConnectionId&api-version=7.1-preview.1"
    
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
        Write-Verbose "Failed to create OIDC token."
        throw (New-Object System.Exception("CouldNotGenerateOidcToken"))
    }
    
    Write-Verbose "OIDC Token generated Successfully"
    return $oidcToken
}
New-Alias -Name 'Get-VstsFederatedToken' -Value 'Global:Get-VstsFederatedTokenPSV2Task' -Scope Global

function Global:Get-WiscAccessTokenPSV2Task {
    param(
        [Parameter(Mandatory=$true)]
        [string]$connectedServiceName
    ) 
    $vstsEndpoint = Get-VstsEndpoint -Name $connectedServiceName -Require

        $result = Get-AccessTokenMSALWithCustomScope -endpoint $vstsEndpoint `
        -connectedServiceNameARM $connectedServiceName `
        -scope "499b84ac-1321-427f-aa17-267ca6975798"

    $token = $null
    $expirationTime = $null
    if($result) {
        $token = $result.AccessToken
        $expirationTime = $([math]::Round(([DateTime]::Parse($result.ExpiresOn) - [DateTime]::Now).TotalMinutes))
    }

    if ($null -eq $token -or $token -eq [string]::Empty) {
        Write-Verbose "Generated token found to be null, returning the System Access Token"
        $token = $env:SystemAccessTokenPowershellV2
    } else {
        Write-Verbose "Successfully generated the Azure Access token for Service Connection : $connectedServiceName"
        if($expirationTime) {
            Write-Host "Generated access token with expiration time of $expirationTime minutes."
        }   
    }
    
    return $token
}
New-Alias -Name 'Get-WiscAccessTokenPSV2Task' -Value 'Global:Get-WiscAccessTokenPSV2Task' -Scope Global

class TokenHandler {
    handle($pipeName) {
        
        $pipe = $null
        $reader = $null

        try {
            $pipe = New-Object System.IO.Pipes.NamedPipeServerStream("$pipeName","InOut")
            
            Write-Verbose "Waiting for a connection..."
            $pipe.WaitForConnection()

            Write-Verbose "Client connected."

            # Read data from the pipe
            $reader = New-Object System.IO.StreamReader($pipe)

            while ($true) {
                $line = $reader.ReadLine()
                if ($null -eq $line) { break }
                if ($line -eq "Stop-Pipe") {break}

                $env:SystemAccessTokenPowershellV2 = Get-VstsTaskVariable -Name 'System.AccessToken' -Require
                $token = ""

                try {
                    [string]$connectedServiceName = (Get-VstsInput -Name ConnectedServiceName)

                    if ($null -eq $connectedServiceName -or $connectedServiceName -eq [string]::Empty) {
                        Write-Verbose "No Service connection was found, returning the System Access Token"
                        $token = $env:SystemAccessTokenPowershellV2
                    } else {
                        $token = Get-WiscAccessTokenPSV2Task -connectedServiceName $connectedServiceName  
                        Write-Verbose "Successfully generated the Azure Access token for Service Connection : $connectedServiceName"
                    }           
                }
                catch {
                    Write-Host "Failed to generate token with message $_, returning the System Access Token"
                    $token = $env:SystemAccessTokenPowershellV2
                } finally {
                    $writer = New-Object System.IO.StreamWriter($pipe)
                    $writer.WriteLine($token)
                    $writer.Flush()
                }
            }
        } finally {
            if($null -ne $reader) {
                $reader.Close()
            }
            if($null -ne $pipe) {
                $pipe.Close()
            }
            Start-Sleep 60
        }
    }
}