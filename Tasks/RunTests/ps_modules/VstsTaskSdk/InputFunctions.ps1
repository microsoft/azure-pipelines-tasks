# Hash table of known variable info. The formatted env var name is the lookup key.
#
# The purpose of this hash table is to keep track of known variables. The hash table
# needs to be maintained for multiple reasons:
#  1) to distinguish between env vars and job vars
#  2) to distinguish between secret vars and public
#  3) to know the real variable name and not just the formatted env var name.
$script:knownVariables = @{ }
$script:vault = @{ }

<#
.SYNOPSIS
Gets an endpoint.

.DESCRIPTION
Gets an endpoint object for the specified endpoint name. The endpoint is returned as an object with three properties: Auth, Data, and Url.

The Data property requires a 1.97 agent or higher.

.PARAMETER Require
Writes an error to the error pipeline if the endpoint is not found.
#>
function Get-Endpoint {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [switch]$Require)

    $originalErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Stop'

        # Get the URL.
        $description = Get-LocString -Key PSLIB_EndpointUrl0 -ArgumentList $Name
        $key = "ENDPOINT_URL_$Name"
        $url = Get-VaultValue -Description $description -Key $key -Require:$Require

        # Get the auth object.
        $description = Get-LocString -Key PSLIB_EndpointAuth0 -ArgumentList $Name
        $key = "ENDPOINT_AUTH_$Name"
        if ($auth = (Get-VaultValue -Description $description -Key $key -Require:$Require)) {
            $auth = ConvertFrom-Json -InputObject $auth
        }

        # Get the data.
        $description = "'$Name' service endpoint data"
        $key = "ENDPOINT_DATA_$Name"
        if ($data = (Get-VaultValue -Description $description -Key $key)) {
            $data = ConvertFrom-Json -InputObject $data
        }

        # Return the endpoint.
        if ($url -or $auth -or $data) {
            New-Object -TypeName psobject -Property @{
                Url = $url
                Auth = $auth
                Data = $data
            }
        }
    } catch {
        $ErrorActionPreference = $originalErrorActionPreference
        Write-Error $_
    }
}

<#
.SYNOPSIS
Gets an input.

.DESCRIPTION
Gets the value for the specified input name.

.PARAMETER AsBool
Returns the value as a bool. Returns true if the value converted to a string is "1" or "true" (case insensitive); otherwise false.

.PARAMETER AsInt
Returns the value as an int. Returns the value converted to an int. Returns 0 if the conversion fails.

.PARAMETER Default
Default value to use if the input is null or empty.

.PARAMETER Require
Writes an error to the error pipeline if the input is null or empty.
#>
function Get-Input {
    [CmdletBinding(DefaultParameterSetName = 'Require')]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(ParameterSetName = 'Default')]
        $Default,
        [Parameter(ParameterSetName = 'Require')]
        [switch]$Require,
        [switch]$AsBool,
        [switch]$AsInt)

    # Get the input from the vault. Splat the bound parameters hashtable. Splatting is required
    # in order to concisely invoke the correct parameter set.
    $null = $PSBoundParameters.Remove('Name')
    $description = Get-LocString -Key PSLIB_Input0 -ArgumentList $Name
    $key = "INPUT_$($Name.Replace(' ', '_').ToUpperInvariant())"
    Get-VaultValue @PSBoundParameters -Description $description -Key $key
}

<#
.SYNOPSIS
Gets a task variable.

.DESCRIPTION
Gets the value for the specified task variable.

.PARAMETER AsBool
Returns the value as a bool. Returns true if the value converted to a string is "1" or "true" (case insensitive); otherwise false.

.PARAMETER AsInt
Returns the value as an int. Returns the value converted to an int. Returns 0 if the conversion fails.

.PARAMETER Default
Default value to use if the input is null or empty.

.PARAMETER Require
Writes an error to the error pipeline if the input is null or empty.
#>
function Get-TaskVariable {
    [CmdletBinding(DefaultParameterSetName = 'Require')]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [Parameter(ParameterSetName = 'Default')]
        $Default,
        [Parameter(ParameterSetName = 'Require')]
        [switch]$Require,
        [switch]$AsBool,
        [switch]$AsInt)

    $originalErrorActionPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Stop'
        $description = Get-LocString -Key PSLIB_TaskVariable0 -ArgumentList $Name
        $variableKey = Get-VariableKey -Name $Name
        if ($script:knownVariables.$variableKey.Secret) {
            # Get secret variable. Splatting is required to concisely invoke the correct parameter set.
            $null = $PSBoundParameters.Remove('Name')
            $vaultKey = "SECRET_$variableKey"
            Get-VaultValue @PSBoundParameters -Description $description -Key $vaultKey
        } else {
            # Get public variable.
            $item = $null
            $path = "Env:$variableKey"
            if ((Test-Path -LiteralPath $path) -and ($item = Get-Item -LiteralPath $path).Value) {
                # Intentionally empty. Value was successfully retrieved.
            } elseif (!$script:nonInteractive) {
                # The value wasn't found and the module is running in interactive dev mode.
                # Prompt for the value.
                Set-Item -LiteralPath $path -Value (Read-Host -Prompt $description)
                if (Test-Path -LiteralPath $path) {
                    $item = Get-Item -LiteralPath $path
                }
            }

            # Get the converted value. Splatting is required to concisely invoke the correct parameter set.
            $null = $PSBoundParameters.Remove('Name')
            Get-Value @PSBoundParameters -Description $description -Key $variableKey -Value $item.Value
        }
    } catch {
        $ErrorActionPreference = $originalErrorActionPreference
        Write-Error $_
    }
}

<#
.SYNOPSIS
Gets all job variables available to the task. Requires 2.104.1 agent or higher.

.DESCRIPTION
Gets a snapshot of the current state of all job variables available to the task.
Requires a 2.104.1 agent or higher for full functionality.

Returns an array of objects with the following properties:
    [string]Name
    [string]Value
    [bool]Secret

Limitations on an agent prior to 2.104.1:
 1) The return value does not include all public variables. Only public variables
    that have been added using setVariable are returned.
 2) The name returned for each secret variable is the formatted environment variable
    name, not the actual variable name (unless it was set explicitly at runtime using
    setVariable).
#>
function Get-TaskVariableInfo {
    [CmdletBinding()]
    param()

    foreach ($info in $script:knownVariables.Values) {
        New-Object -TypeName psobject -Property @{
            Name = $info.Name
            Value = Get-TaskVariable -Name $info.Name
            Secret = $info.Secret
        }
    }
}

<#
.SYNOPSIS
Sets a task variable.

.DESCRIPTION
Sets a task variable in the current task context as well as in the current job context. This allows the task variable to retrieved by subsequent tasks within the same job.
#>
function Set-TaskVariable {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name,
        [string]$Value,
        [switch]$Secret)

    # Once a secret always a secret.
    $variableKey = Get-VariableKey -Name $Name
    [bool]$Secret = $Secret -or $script:knownVariables.$variableKey.Secret
    if ($Secret) {
        $vaultKey = "SECRET_$variableKey"
        if (!$Value) {
            # Clear the secret.
            Write-Verbose "Set $Name = ''"
            $script:vault.Remove($vaultKey)
        } else {
            # Store the secret in the vault.
            Write-Verbose "Set $Name = '********'"
            $script:vault[$vaultKey] = New-Object System.Management.Automation.PSCredential(
                $vaultKey,
                (ConvertTo-SecureString -String $Value -AsPlainText -Force))
        }

        # Clear the environment variable.
        Set-Item -LiteralPath "Env:$variableKey" -Value ''
    } else {
        # Set the environment variable.
        Write-Verbose "Set $Name = '$Value'"
        Set-Item -LiteralPath "Env:$variableKey" -Value $Value
    }

    # Store the metadata.
    $script:knownVariables[$variableKey] = New-Object -TypeName psobject -Property @{
            Name = $name
            Secret = $Secret
        }

    # Persist the variable in the task context.
    Write-SetVariable -Name $Name -Value $Value -Secret:$Secret
}

########################################
# Private functions.
########################################
function Get-VaultValue {
    [CmdletBinding(DefaultParameterSetName = 'Require')]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Description,
        [Parameter(Mandatory = $true)]
        [string]$Key,
        [Parameter(ParameterSetName = 'Require')]
        [switch]$Require,
        [Parameter(ParameterSetName = 'Default')]
        [object]$Default,
        [switch]$AsBool,
        [switch]$AsInt)

    # Attempt to get the vault value.
    $value = $null
    if ($psCredential = $script:vault[$Key]) {
        $value = $psCredential.GetNetworkCredential().Password
    } elseif (!$script:nonInteractive) {
        # The value wasn't found. Prompt for the value if running in interactive dev mode.
        $value = Read-Host -Prompt $Description
        if ($value) {
            $script:vault[$Key] = New-Object System.Management.Automation.PSCredential(
                $Key,
                (ConvertTo-SecureString -String $value -AsPlainText -Force))
        }
    }

    Get-Value -Value $value @PSBoundParameters
}

function Get-Value {
    [CmdletBinding(DefaultParameterSetName = 'Require')]
    param(
        [string]$Value,
        [Parameter(Mandatory = $true)]
        [string]$Description,
        [Parameter(Mandatory = $true)]
        [string]$Key,
        [Parameter(ParameterSetName = 'Require')]
        [switch]$Require,
        [Parameter(ParameterSetName = 'Default')]
        [object]$Default,
        [switch]$AsBool,
        [switch]$AsInt)

    $result = $Value
    if ($result) {
        if ($Key -like 'ENDPOINT_AUTH_*') {
            Write-Verbose "$($Key): '********'"
        } else {
            Write-Verbose "$($Key): '$result'"
        }
    } else {
        Write-Verbose "$Key (empty)"

        # Write error if required.
        if ($Require) {
            Write-Error "$(Get-LocString -Key PSLIB_Required0 $Description)"
            return
        }

        # Fallback to the default if provided.
        if ($PSCmdlet.ParameterSetName -eq 'Default') {
            $result = $Default
            $OFS = ' '
            Write-Verbose " Defaulted to: '$result'"
        } else {
            $result = ''
        }
    }

    # Convert to bool if specified.
    if ($AsBool) {
        if ($result -isnot [bool]) {
            $result = "$result" -in '1', 'true'
            Write-Verbose " Converted to bool: $result"
        }

        return $result
    }

    # Convert to int if specified.
    if ($AsInt) {
        if ($result -isnot [int]) {
            try {
                $result = [int]"$result"
            } catch {
                $result = 0
            }

            Write-Verbose " Converted to int: $result"
        }

        return $result
    }

    return $result
}

function Initialize-Inputs {
    # Store endpoints, inputs, and secret variables in the vault.
    foreach ($variable in (Get-ChildItem -Path Env:ENDPOINT_?*, Env:INPUT_?*, Env:SECRET_?*)) {
        # Record the secret variable metadata. This is required by Get-TaskVariable to
        # retrieve the value. In a 2.104.1 agent or higher, this metadata will be overwritten
        # when $env:VSTS_SECRET_VARIABLES is processed.
        if ($variable.Name -like 'SECRET_?*') {
            $variableKey = $variable.Name.Substring('SECRET_'.Length)
            $script:knownVariables[$variableKey] = New-Object -TypeName psobject -Property @{
                # This is technically not the variable name (has underscores instead of dots),
                # but it's good enough to make Get-TaskVariable work in a pre-2.104.1 agent
                # where $env:VSTS_SECRET_VARIABLES is not defined.
                Name = $variableKey
                Secret = $true
            }
        }

        # Store the value in the vault.
        $vaultKey = $variable.Name
        if ($variable.Value) {
            $script:vault[$vaultKey] = New-Object System.Management.Automation.PSCredential(
                $vaultKey,
                (ConvertTo-SecureString -String $variable.Value -AsPlainText -Force))
        }

        # Clear the environment variable.
        Remove-Item -LiteralPath "Env:$($variable.Name)"
    }

    # Record the public variable names. Env var added in 2.104.1 agent.
    if ($env:VSTS_PUBLIC_VARIABLES) {
        foreach ($name in (ConvertFrom-Json -InputObject $env:VSTS_PUBLIC_VARIABLES)) {
            $variableKey = Get-VariableKey -Name $name
            $script:knownVariables[$variableKey] = New-Object -TypeName psobject -Property @{
                Name = $name
                Secret = $false
            }
        }

        $env:VSTS_PUBLIC_VARIABLES = ''
    }

    # Record the secret variable names. Env var added in 2.104.1 agent.
    if ($env:VSTS_SECRET_VARIABLES) {
        foreach ($name in (ConvertFrom-Json -InputObject $env:VSTS_SECRET_VARIABLES)) {
            $variableKey = Get-VariableKey -Name $name
            $script:knownVariables[$variableKey] = New-Object -TypeName psobject -Property @{
                Name = $name
                Secret = $true
            }
        }

        $env:VSTS_SECRET_VARIABLES = ''
    }
}

function Get-VariableKey {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name)

    if ($Name -ne 'agent.jobstatus') {
        $Name = $Name.Replace('.', '_')
    }

    $Name.ToUpperInvariant()
}
