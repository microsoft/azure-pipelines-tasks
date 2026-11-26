$credentialVariableNames = @(
    "endpoint",
    "endpointObject",
    "connectedServiceNameARM",
    "vstsAccessToken",
    "encryptedToken"
)
$leakedCredentialVariables = @(
    $credentialVariableNames |
        Where-Object { Get-Variable -Name $_ -ErrorAction SilentlyContinue }
)

if ($leakedCredentialVariables.Count -gt 0) {
    Write-Output "CREDENTIAL_SCOPE_LEAK:$($leakedCredentialVariables -join ',')"
}
else {
    Write-Output "CREDENTIAL_SCOPE_CLEAN"
}
