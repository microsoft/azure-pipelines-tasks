function Get-JavaDevelopmentKitPath{
    [CmdletBinding()]
    param(
        [string]$Version,
        [string]$Arch)

    Trace-VstsEnteringInvocation $MyInvocation
    try {
        # Check for JDK
        $jdkKeyName;
        if ($Version -eq '1.8') {
            $jdkKeyName = "Software\JavaSoft\Java Development Kit\1.8"
        }
        ElseIf ($Version -eq '1.7') {
            $jdkKeyName = "Software\JavaSoft\Java Development Kit\1.7"
        }
        ElseIf ($Version -eq '1.6') {
            $jdkKeyName = "Software\JavaSoft\Java Development Kit\1.6"
        }
        if($Arch -eq 'x64') {
            $view = "Registry64"
        }
        ElseIf ($Arch -eq 'x86') {
            $view = "Registry32"
        }

        $jdkPath;
        if (-not [string]::IsNullOrEmpty($jdkKeyName)) {
            $jdkPath = Get-RegistryValue -Hive 'LocalMachine' -View $view -KeyName $jdkKeyName -ValueName 'JavaHome'
        }
        
        Write-Verbose "jdkPath from registry = $jdkPath"
        if ([string]::IsNullOrEmpty($jdkPath)) {
            $jdkVersionShort = $jdkVersion.Substring(2)
            $javaHomeEnvVariable = "JAVA_HOME_" + $jdkVersionShort + "_" + $jdkArchitecture
            Write-Verbose "javaHomeEnvVariable = $javaHomeEnvVariable"
            try {
                $jdkPath = (Get-Item env:$javaHomeEnvVariable).Value
            } catch {
                throw "Failed to find the specified JDK version. Please ensure the specified JDK version is installed on the agent and the environment variable $javaHomeEnvVariable exists and is set to the location of a corresponding JDK or use the [Java Tool Installer](https://go.microsoft.com/fwlink/?linkid=875287) task to install the desired JDK."
            }
        }
        
        Write-Verbose "jdkPath from environment variable $javaHomeEnvVariable = $jdkPath"
        if ([string]::IsNullOrEmpty($jdkPath)) {
            throw "Failed to find the specified JDK version. Please ensure the specified JDK version is installed on the agent or use the [Java Tool Installer](https://go.microsoft.com/fwlink/?linkid=875287) task to install the desired JDK."
        }
        return $jdkPath
    } finally {
        Trace-VstsLeavingInvocation $MyInvocation
    }
}

function Get-RegistryValue {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet('CurrentUser', 'LocalMachine')]
        [string]$Hive,

        [Parameter(Mandatory = $true)]
        [ValidateSet('Default', 'Registry32', 'Registry64')]
        [string]$View,

        [Parameter(Mandatory = $true)]
        [string]$KeyName,

        [string]$ValueName)

    Write-Verbose "Checking: hive '$Hive', view '$View', key name '$KeyName', value name '$ValueName'"
    if ($View -eq 'Registry64' -and !([System.Environment]::Is64BitOperatingSystem)) {
        Write-Verbose "Skipping."
        return
    }

    $baseKey = $null
    $subKey = $null
    try {
        # Open the base key.
        $baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey($Hive, $View)

        # Open the sub key as read-only.
        $subKey = $baseKey.OpenSubKey($KeyName, $false)

        # Check if the sub key was found.
        if (!$subKey) {
            Write-Verbose "Key not found."
            return
        }

        # Get the value.
        $value = $subKey.GetValue($ValueName)

        # Check if the value was not found or is empty.
        if ([System.Object]::ReferenceEquals($value, $null) -or
            ($value -is [string] -and !$value)) {

            Write-Verbose "Value not found or is empty."
            return
        }

        # Return the value.
        Write-Verbose "Found $($value.GetType().Name) value: '$value'"
        return $value
    } finally {
        # Dispose the sub key.
        if ($subKey) {
            $null = $subKey.Dispose()
        }

        # Dispose the base key.
        if ($baseKey) {
            $null = $baseKey.Dispose()
        }
    }
}
