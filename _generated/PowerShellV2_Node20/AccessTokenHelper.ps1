Import-Module $PSScriptRoot\ps_modules\VstsAzureRestHelpers_
Import-Module $PSScriptRoot\ps_modules\VstsTaskSdk

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
        #Write-Verbose "Failed to create OIDC token."
        $env:praval = $env:praval + "Failed to create OIDC token."
        throw (New-Object System.Exception("CouldNotGenerateOidcToken"))
    }

    $env:praval = $env:praval +  "OIDC Token generated Successfully"
    return $oidcToken
}
New-Alias -Name 'Get-VstsFederatedToken' -Value 'Global:Get-VstsFederatedTokenPSV2Task' -Scope Global

function Global:Get-WiscAccessTokenPSV2Task {
    param(
        [Parameter(Mandatory=$true)]
        [string]$connectedServiceName
    ) 

    $env:praval = $env:praval + "`n" + "Inside Get-WiscAccessTokenPSV2Task"

    $vstsEndpoint = Get-VstsEndpoint -Name $connectedServiceName -Require

    $env:praval = $env:praval + "`n" + "$vstsEndpoint"

    try {
        $result = Get-AccessTokenMSALWithCustomScope -endpoint $vstsEndpoint `
        -connectedServiceNameARM $connectedServiceName `
        -scope "499b84ac-1321-427f-aa17-267ca6975798"
    } catch {
        $env:praval = $env:praval + "`n" + "Get-AccessTokenMSALWithCustomScope failed with $_"
        throw $_
    }

    $token = $null
    $expirationTime = $null
    if($result) {
        $token = $result.AccessToken
        $expirationTime = $([math]::Round(([DateTime]::Parse($result.ExpiresOn) - [DateTime]::Now).TotalMinutes))
    }

    if ($null -eq $token -or $token -eq [string]::Empty) {
        $env:praval = $env:praval + "Generated token found to be null, returning the System Access Token"
        $token = $env:SystemAccessTokenPowershellV2
    } else {
        $env:praval = $env:praval + "`n" +  "Successfully generated the Azure Access token for Service Connection : $connectedServiceName"
        if($expirationTime) {
            $env:praval = $env:praval + "`n" +  "Generated access token with expiration time of $expirationTime minutes."
        }   
    }
    
    return $token
}
New-Alias -Name 'Get-WiscAccessTokenPSV2Task' -Value 'Global:Get-WiscAccessTokenPSV2Task' -Scope Global

# $tokenHandler = [PSCustomObject]@{

#     TokenHandler = {
#         param(
#             [Parameter(Mandatory=$true)]
#             [string]$filePath,
#             [Parameter(Mandatory=$true)]
#             [string]$signalFromUserScript,
#             [Parameter(Mandatory=$true)]
#             [string]$signalFromTask,
#             [Parameter(Mandatory=$true)]
#             [string]$exitSignal
#         )

#         $eventFromUserScript = $null
#         $eventFromTask = $null
#         $eventExit = $null

#         try {
#             $eventFromUserScript = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, $signalFromUserScript)
#             $eventFromTask = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, $signalFromTask)
#             $eventExit = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, $exitSignal)

#             # Ensure the output file has restricted permissions
#             if (-not (Test-Path $filePath)) {
#                 New-Item -Path $filePath -ItemType File -Force
#                 $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

#                 # Create a new ACL that only grants access to the current user
#                 $acl = Get-Acl $filePath
#                 $acl.SetAccessRuleProtection($true, $false)  # Disable inheritance
#                 $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
#                     $currentUser, "FullControl", "Allow"
#                 )
#                 $acl.SetAccessRule($rule)

#                 # Apply the ACL to the file
#                 Set-Acl -Path $filePath -AclObject $acl
#             } else {
#                 $env:praval = $env:praval + "`n" +  "Token File not found"
#                 throw "Token File not found"
#             }

#             $env:praval = $env:praval + "`n" +  "Task: Waiting for signals..."

#             # Infinite loop to wait for signals and respond
#             while ($true) {
#                 try {
#                     # Wait for either UserScript signal or Exit signal
#                     $index = [System.Threading.WaitHandle]::WaitAny(@($eventFromUserScript, $eventExit))

#                     if ($index -eq 0) {

#                         # Signal from UserScript
#                         $env:SystemAccessTokenPowershellV2 = Get-VstsTaskVariable -Name 'System.AccessToken' -Require
#                         $token = ""
#                         try {
#                             [string]$connectedServiceName = (Get-VstsInput -Name ConnectedServiceName)
#                             $env:praval = $env:praval + "`n" + "ConnectedServiceName $connectedServiceName"

#                             if ($null -eq $connectedServiceName -or $connectedServiceName -eq [string]::Empty) {
#                                 $env:praval = $env:praval + "`n" +  "No Service connection was found, returning the System Access Token"
#                                 $token = $env:SystemAccessTokenPowershellV2
#                             } else {
#                                 $token = Get-WiscAccessTokenPSV2Task -connectedServiceName $connectedServiceName  
#                                 $env:praval = $env:praval + "`n" +   "Successfully generated the Azure Access token for Service Connection : $connectedServiceName"
#                             }           
#                         }
#                         catch {
#                             $env:praval = $env:praval + "`n" +  "Failed to generate token with message $_, returning the System Access Token"
#                             $token = $env:SystemAccessTokenPowershellV2
                                
#                         } finally {
#                             $token | Set-Content -Path $filePath
#                             $env:praval = $env:praval + "`n" +  "Task: Wrote access token to file"
#                         }

#                         # Signal UserScript to read the file
#                         $tmp = $eventFromTask.Set()

#                     } elseif ($index -eq 1) {
#                         $env:praval = $env:praval + "`n" +  "Exiting the loop"
#                         # Exit signal received
#                         break
#                     }
#                 } catch {
#                     $env:praval = $env:praval + "`n" +  "Error occurred while waiting for signals: $_"
#                 }
#             }
#         } catch {
#             $env:praval = $env:praval + "`n" + "Critical error in Task: $_"
#         } finally {
#             try {
#                 if ($null -ne $eventFromUserScript ) { $eventFromUserScript.Dispose() }
#                 if ($null -ne $eventFromTask) { $eventFromTask.Dispose() }
#                 if ($null -ne $eventExit) { $eventExit.Dispose() }
#             } catch {
#                 # do nothing
#             }
#         }
#     }
# }

class TokenHandler {
    handle($s)
    {
        $array = $s -split '::'
        Write-Host $array
        [string]$filePath = $array[0]
        [string]$signalFromUserScript = $array[1]
        [string]$signalFromTask = $array[2]
        [string]$exitSignal = $array[3]

        $eventFromUserScript = $null
        $eventFromTask = $null
        $eventExit = $null

        try {
            $eventFromUserScript = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, $signalFromUserScript)
            $eventFromTask = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, $signalFromTask)
            $eventExit = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::AutoReset, $exitSignal)

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
            } else {
                $env:praval = $env:praval + "`n" +  "Token File not found"
                throw "Token File not found"
            }

            $env:praval = $env:praval + "`n" +  "Task: Waiting for signals..."
            Write-Host "Task: Waiting for signals..."

            # Infinite loop to wait for signals and respond
            while ($true) {
                try {
                    # Wait for either UserScript signal or Exit signal
                    $index = [System.Threading.WaitHandle]::WaitAny(@($eventFromUserScript, $eventExit))

                    if ($index -eq 0) {

                        # Signal from UserScript
                        $env:SystemAccessTokenPowershellV2 = Get-VstsTaskVariable -Name 'System.AccessToken' -Require
                        Write-Host $env:SystemAccessTokenPowershellV2

                        $token = ""
                        try {
                            [string]$connectedServiceName = (Get-VstsInput -Name ConnectedServiceName)
                            $env:praval = $env:praval + "`n" + "ConnectedServiceName $connectedServiceName"
                            Write-Host "ConnectedServiceName $connectedServiceName"

                            if ($null -eq $connectedServiceName -or $connectedServiceName -eq [string]::Empty) {
                                $env:praval = $env:praval + "`n" +  "No Service connection was found, returning the System Access Token"
                                $token = $env:SystemAccessTokenPowershellV2
                                Write-Host "No Service connection was found, returning the System Access Token"
                            } else {
                                $token = Get-WiscAccessTokenPSV2Task -connectedServiceName $connectedServiceName  
                                $env:praval = $env:praval + "`n" +   "Successfully generated the Azure Access token for Service Connection : $connectedServiceName"
                                Write-Host "Successfully generated the Azure Access token for Service Connection : $connectedServiceName"
                            }           
                        }
                        catch {
                            $env:praval = $env:praval + "`n" +  "Failed to generate token with message $_, returning the System Access Token"
                            Write-Host "Failed to generate token with message $_, returning the System Access Token"
                            $token = $env:SystemAccessTokenPowershellV2
                                
                        } finally {
                            $token | Set-Content -Path $filePath
                            $env:praval = $env:praval + "`n" +  "Task: Wrote access token to file"
                            Write-Host "Task: Wrote access token to file"
                        }

                        # Signal UserScript to read the file
                        $tmp = $eventFromTask.Set()

                    } elseif ($index -eq 1) {
                        $env:praval = $env:praval + "`n" +  "Exiting the loop"
                        Write-Host "Exiting the loop"
                        # Exit signal received
                        break
                    }
                } catch {
                    $env:praval = $env:praval + "`n" +  "Error occurred while waiting for signals: $_"
                    Write-Host "Error occurred while waiting for signals: $_"
                }
            }
        } catch {
            $env:praval = $env:praval + "`n" + "Critical error in Task: $_"
            Write-Host "Critical error in Task: $_"
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