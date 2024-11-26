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

    # Construct the API URL
    $url = $uri + "$projectId/_apis/distributedtask/hubs/$hub/plans/$planId/jobs/$jobId/oidctoken?serviceConnectionId=$serviceConnectionId&api-version=7.1-preview.1"
    
    $headers = @{
        "Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes(":$($vstsAccessToken)"))
        "Content-Type"  = "application/json"
    }
    
    # Make the POST request to generate the OIDC token
    $response = Invoke-WebRequest -Uri $url -Method Post -Headers $headers -Body $body

    # Parse the response content to extract the OIDC token
    $responseContent = $response.Content | ConvertFrom-Json
    $oidcToken = $responseContent.oidcToken  # The token field contains the OIDC token


    if ($null -eq $oidcToken -or $oidcToken -eq [string]::Empty) {
        Write-Host "Failed to create OIDC token."
        throw (New-Object System.Exception(Get-VstsLocString -Key AZ_CouldNotGenerateOidcToken))
    }

    Write-Host "OIDC Token generated Successfully"
    return $oidcToken
}
New-Alias -Name 'Get-VstsFederatedToken' -Value 'Global:Get-VstsFederatedTokenPSV2Task' -Scope Global

function Global:Get-WiscAccessTokenPSV2Task {
    param(
        [Parameter(Mandatory=$true)]
        [string]$connectedServiceName
    )

    $token = $env:SystemAccessTokenPowershellV2
    
    $vstsEndpoint = Get-VstsEndpoint -Name $connectedServiceName -Require

    $result = Get-AccessTokenMSALWithCustomScope -endpoint $vstsEndpoint `
        -connectedServiceNameARM $connectedServiceName `
        -scope "499b84ac-1321-427f-aa17-267ca6975798"

    $token = $result.AccessToken

    if ($null -eq $token -or $token -eq [string]::Empty) {
        Write-Host "Generated token found to be null, returning the System Access Token"
        $token = $env:SystemAccessTokenPowershellV2
    } else {
        Write-Host "Successfully generated the Azure Access token for Service Connection : $connectedServiceName"
    }
    
    return $token
}
New-Alias -Name 'Get-WiscAccessTokenPSV2Task' -Value 'Global:Get-WiscAccessTokenPSV2Task' -Scope Global

$tokenHandler = [PSCustomObject]@{

    TokenHandler = {
        param(
            [Parameter(Mandatory=$true)]
            [string]$filePath
        )

        $signalFromUserScript = "Global\SignalFromUserScript"
        $signalFromTask = "Global\SignalFromTask"
        $exitSignal = "Global\ExitSignal"

        $eventFromUserScript = $null
        $eventFromTask = $null
        $eventExit = $null

        try {
            $eventFromUserScript = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::AutoReset, $signalFromUserScript)
            $eventFromTask = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::AutoReset, $signalFromTask)
            $eventExit = [System.Threading.EventWaitHandle]::new($false, [System.Threading.EventResetMode]::AutoReset, $exitSignal)

            # Ensure the output file has restricted permissions
            if (-not (Test-Path $filePath)) {
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

            Write-Host "Task: Waiting for signals..."

            # Infinite loop to wait for signals and respond
            while ($true) {
                try {
                    # Wait for either UserScript signal or Exit signal
                    $index = [System.Threading.WaitHandle]::WaitAny(@($eventFromUserScript, $eventExit))

                    if ($index -eq 0) {
                        # Signal from UserScript
                        $env:SystemAccessTokenPowershellV2 = Get-VstsTaskVariable -Name 'System.AccessToken' -Require
                        $token = ""
                        try {
                            [string]$connectedServiceName = (Get-VstsInput -Name ConnectedServiceName)

                            if ($null -eq $connectedServiceName -or $connectedServiceName -eq [string]::Empty) {
                                Write-Host "No Service connection was found, returning the System Access Token"
                                $token = $env:SystemAccessTokenPowershellV2
                            } else {
                                $token = Get-WiscAccessTokenPSV2Task -connectedServiceName $connectedServiceName  
                                Write-Host "Successfully generated the Azure Access token for Service Connection : $connectedServiceName"
                            }                
                        }
                        catch {
                            Write-Host "Failed to generate token with message $_, returning the System Access Token"
                            $token = $env:SystemAccessTokenPowershellV2
                                
                        } finally {
                            $token | Set-Content -Path $filePath
                            Write-Host "Task: Wrote access token to file"
                        }

                        # Signal UserScript to read the file
                        $eventFromTask.Set()
                    } elseif ($index -eq 1) {
                        # Exit signal received
                        Write-Host "Task: Exit signal received. Exiting loop..."
                        break
                    }
                } catch {
                    Write-Host "Error occurred while waiting for signals: $_"
                }
            }
        } catch {
            Write-Host "Critical error in Task: $_"
        } finally {
            # Cleanup resources
            if ($null -ne $eventFromUserScript ) { $eventFromUserScript.Dispose() }
            if ($null -ne $eventFromTask) { $eventFromTask.Dispose() }
            if ($null -ne $eventExit) { $eventExit.Dispose() }
            Write-Host "Task: Resources cleaned up. Exiting."
        }
    }
}