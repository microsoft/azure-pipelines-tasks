function Locate-TestVersionAndVsRoot([string] $Version)
{
    if ([string]::IsNullOrWhiteSpace($Version))
    {
        #Find the latest version
        $regPath = "HKLM:\SOFTWARE\Microsoft\DevDiv\vstf\Servicing"
        if (-not (Test-Path $regPath))
        {
            $regPath = "HKLM:\SOFTWARE\Wow6432Node\Microsoft\DevDiv\vstf\Servicing"
        }
        
        $Version = Get-Item $regPath | %{$_.GetSubKeyNames()} | Sort-Object -Descending | Select-Object -First 1
        if ([string]::IsNullOrWhiteSpace($Version))
        {
            return $null
        }
    }

    # Lookup the install location
    $installRegPath = ("SOFTWARE\Microsoft\VisualStudio\{0}\EnterpriseTools\QualityTools" -f $Version)

    $installRoot = Get-RegistryValueIgnoreError CurrentUser "$installRegPath" "InstallDir" Registry32
    if (-not $installRoot)
    {
        $installRoot = Get-RegistryValueIgnoreError CurrentUser "$installRegPath" "InstallDir" Registry64
    }

    if (-not $installRoot)
    {
        $installRoot = Get-RegistryValueIgnoreError LocalMachine "$installRegPath" "InstallDir" Registry32
        if (-not $installRoot)
        {
            $installRoot = Get-RegistryValueIgnoreError LocalMachine "$installRegPath" "InstallDir" Registry64
        }
    }

    if (-not $installRoot)
    {
        # We still got nothing
        throw "Unable to find TestAgent installation path"
    }
    return $installRoot
}

function Get-RegistryValueIgnoreError
{
    param
    (
        [parameter(Mandatory = $true)]
        [Microsoft.Win32.RegistryHive]
        $RegistryHive,

        [parameter(Mandatory = $true)]
        [System.String]
        $Key,

        [parameter(Mandatory = $true)]
        [System.String]
        $Value,

        [parameter(Mandatory = $true)]
        [Microsoft.Win32.RegistryView]
        $RegistryView
    )

    try
    {
        $baseKey = [Microsoft.Win32.RegistryKey]::OpenBaseKey($RegistryHive, $RegistryView)
        $subKey =  $baseKey.OpenSubKey($Key)
        if($subKey -ne $null)
        {
            return $subKey.GetValue($Value)
        }
    }
    catch
    {
        #ignore
    }
    return $null
}

function InvokeTestAgentConfigExe([string[]] $Arguments, [string] $Version)
{
    $ExeName = "TestAgentConfig.exe"
    if (-not (Test-IsAdmin))
    {
        throw "You need to be an Administrator to run this tool."
    }

    $vsRoot = Locate-TestVersionAndVsRoot($Version)
    if ([string]::IsNullOrWhiteSpace($vsRoot))
    {
        throw "Could not locate TestAgent installation directory for `$Version=$Version. Ensure that TestAgent is installed."
    }

    $exePath = Join-Path -Path $vsRoot -ChildPath $ExeName
    if (Test-Path $exePath)
    {
        $pinfo = New-Object System.Diagnostics.ProcessStartInfo
        $pinfo.FileName = $exePath
        $pinfo.RedirectStandardError = $true
        $pinfo.RedirectStandardOutput = $true
        $pinfo.UseShellExecute = $false
        $pinfo.Arguments = $Arguments

        $p = New-Object System.Diagnostics.Process
        $p.StartInfo = $pinfo

        $p.Start() | Out-Null
        $p.WaitForExit()

        $stdout = $p.StandardOutput.ReadToEnd()
        $stderr = $p.StandardError.ReadToEnd()

        Write-Verbose -Message ("Stdout : {0}" -f $stdout) -Verbose
        Write-Warning -Message ("Stderr : {0}" -f $stderr)
        Write-Verbose -Message ("Exit code : {0}" -f $p.ExitCode) -Verbose

        $out = @{
                    ExitCode = $p.ExitCode
                    CommandOutput = $stdout
                }
					
        return $out
    }

    throw "Did not find TestAgentConfig.exe at : $exePath. Ensure that TestAgent is installed."
}


function TestAgent-UnRegister
{
 param
    (
        [String] $TestAgentVersion 
    )

    $dtaLogFile = Join-Path $env:SystemDrive "DtaLogs" | Join-Path -ChildPath "DTAExecutionHost.exe.log" #filename also present in testagentconfiguration.ps1
    if(Test-path -Path $dtaLogFile) 
    {
        Write-Verbose -Message "=== Starting to print the dtaexecutionhost log file for [$env:COMPUTERNAME] ===" -Verbose
        Get-Content $dtaLogFile | Select -Last 100 | foreach { Write-Verbose -Message "[$env:COMPUTERNAME] $_" -Verbose }
        Write-Verbose -Message "=== Done printing the dtaexecutionhost log file for [$env:COMPUTERNAME] ===" -Verbose
    }

    Write-Verbose -Message "Trying to delete TestAgent configurations." -verbose

    $configOut = InvokeTestAgentConfigExe -Arguments @( "Delete" ) -Version $TestAgentVersion         
    return $configOut.ExitCode
}

function Test-IsAdmin
{
    $wid = [System.Security.Principal.WindowsIdentity]::GetCurrent()
    $prp = New-Object System.Security.Principal.WindowsPrincipal($wid)
    $adm = [System.Security.Principal.WindowsBuiltInRole]::Administrator
    return $prp.IsInRole($adm)
}

$output = TestAgent-UnRegister -TestAgentVersion $TestAgentVersion