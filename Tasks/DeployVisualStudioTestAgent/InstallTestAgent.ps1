function ExtractAgentArchive ($SetupArchive, $Destination) {
    Write-Verbose "Extracting the archive $SetupArchive"
    Try {
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        function Unzip {
            param([string]$zipfile, [string]$outpath)
            [System.IO.Compression.ZipFile]::ExtractToDirectory($zipfile, $outpath)
        }
        Unzip $SetupArchive $Destination
    }
    Catch {
        Write-Warning $_
    }
}

function InstallTestAgent2017 {
    param
    (
        [String] $SetupPath,
        [String] $InstallPath
    )

    if (-not (Test-Path -Path $SetupPath)) {
        throw "Test agent source path '{0}' is not accessible to the test machine. Please check if the file exists and that test machine has access to that machine" -f $SetupPath
    }

    # First we need to install the certificates for TA 2017
    $SetupDir = Split-Path -Path $SetupPath
    Write-Verbose "Installing test agent certificates"
    Get-ChildItem -Path "$SetupDir\certificates\*.p12" -ErrorAction SilentlyContinue | Import-PfxCertificate -CertStoreLocation Cert:\CurrentUser\My -Exportable

    $p = New-Object System.Diagnostics.Process
    $Processinfo = New-Object System.Diagnostics.ProcessStartInfo
    $Processinfo.CreateNoWindow = $true
    $Processinfo.UseShellExecute = $false
    $Processinfo.LoadUserProfile = $false
    $Processinfo.FileName = "$SetupPath"
    $Processinfo.Arguments = "--wait --quiet --norestart --installPath $InstallPath"

    $p.StartInfo = $Processinfo
    $p.Start()

    # it shouldn't take more than 1hr.
    if ($p.WaitForExit(3600000)) {
        Write-Warning "Installation couldn't get completed in an hour. Terminating the process".
        Stop-Process $p -ErrorAction SilentlyContinue
        return -1
    } 

    return $p.ExitCode
}

function Install-Product($SetupPath, $ProductVersion, $Update) {
    $exitCode = 0

    Write-Verbose "Setup path: $SetupPath" -Verbose
    if (-not (Test-Path $SetupPath)) {
        Write-Verbose "Test Agent path $SetupPath is invalid. Skipping the installation"
        return 1801
    }

    # Since TA 2017 requires certificates and it's shipped with layout which needs to be archived in order to install offline
    if ($SetupPath -ilike "*TestAgent.zip") {
        $SetupDir = Split-Path -Path $SetupPath
        ExtractAgentArchive -SetupArchive $SetupPath -Destination $SetupDir
        $SetupPath = Join-Path $SetupDir "vs_TestAgent.exe"
    }

    $versionToInstall = ((Get-Item $SetupPath).VersionInfo.ProductVersion)
    $versionInstalled = Get-TestAgentInstalledVersion -ProductVersion $ProductVersion # Get installed test agent version as per user requested version

    if ($versionToInstall -ne $null) {
        $versionToInstall = $versionToInstall.SubString(0, $versionToInstall.LastIndexOf('.'))
    }

    Write-Verbose "Installed Test Agent version: $versionInstalled"
    Write-Verbose "Requested Test Agent version: $versionToInstall"

    if ([version]$versionInstalled -gt ([version]"0.0") -and $Update -ieq "false") {
        # Test Agent installed with major version matching. No update requested
        Write-Verbose -Message ("Test Agent already exists") -verbose
        return $exitCode
    }
    if ([version]$versionInstalled -gt ([version]"0.0") -and [version]$versionInstalled -le [version]$versionToInstall) {
        # Already upto date. Ignore Update flag
        Write-Verbose -Message ("Test Agent is already upto date") -verbose
        return $exitCode
    }

    if ([version]$versionInstalled -eq ([version]"0.0")) {
        # Test Agent is not installed with major version matching. Any other installations are ignored
        Write-Verbose -Message ("Test Agent will be installed") -verbose
    }
    if ([version]$versionInstalled -gt ([version]"0.0") -and [version]$versionInstalled -lt [version]$versionToInstall -and $Update -ieq "true") {
        Write-Verbose -Message ("Test Agent will be updated from: {0} to: {1}" -f $versionInstalled, $versionToInstall) -verbose
    }

    try {
        # Invoke the TA installation
        if ($ProductVersion -eq "15.0") {
            $tpPath = Join-Path $env:SystemDrive TestAgent2017
            $retCode = InstallTestAgent2017 -SetupPath $SetupPath -InstallPath $tpPath
            if ($retCode -is [System.Array]) {
                $exitCode = $retCode[$retCode.Length - 1]
            }
            else {
                $exitCode = $retCode
            }
            Write-Verbose -Message ("Exit code from installation $exitCode ") -verbose
        }
        else {
            $argumentsarr = @("/Quiet", "/NoRestart")
            Write-Verbose -Message ("Invoking the command {0} with arguments {1}" -f $SetupPath, $Arguments) -verbose
            $retCode = Invoke-Command -ScriptBlock { cmd.exe /c $args[0] $args[1]; $LASTEXITCODE } -ArgumentList $SetupPath, $argumentsarr -ErrorAction Stop
            if ($retCode -is [System.Array]) {
                $exitCode = $retCode[$retCode.Length - 1]
            }
            else {
                $exitCode = $retCode
            }
        }
    }
    catch {
        Write-Verbose -Verbose "Caught exception while installing Test Agent"
        throw $_.Exception
    }

    if ($exitCode -eq -2147185721) {
        # pending restart .
        try {
            $testAgentFile = "$env:SystemDrive\TestAgent\testagent.txt"
            $testAgentFileExists = Test-Path $testAgentFile
            if ($testAgentFileExists) {
                # delete the file which indicated that test agent installation failed.
                Remove-Item $testAgentFile -force | Out-Null
                # we have retried once .Now fail with appropriate message
                Write-Verbose -Verbose "Retried to install Test Agent"
                throw ("The return code {0} was not expected during installation of Test Agent. Check the installation logs for more details." -f $exitCode.ToString())
            }
            else {
                #creating testagent file to indicate testagent installation failed.
                New-Item -Path $testAgentFile -type File | Out-Null
                Write-Verbose -Message ("Installation of Test Agent failed with Error code {0}. Retrying once by rebooting machine" -f $exitCode.ToString()) -Verbose
                return 3010;
            }
        }
        catch {
            Write-Verbose -Verbose "Error occurred while retrying the Test Agent installation"
            throw ("The return code {0} was not expected during installation of Test Agent. Check the installation logs for more details." -f $exitCode.ToString())
        }
    }

    if ($exitCode -eq -2147205120) {
        # pending windows update.
        throw ("Pending windows update. The return code {0} was not expected during installation of Test Agent. Install windows update and try again." -f $exitCode.ToString())
    }

    if (-not ($exitCode -eq 0 -or $exitCode -eq 3010 -or $exitCode -eq 3015 -or $exitCode -eq 1641)) {
        throw ("The return code {0} was not expected during installation of Test Agent. Check the installation logs for more details." -f $exitCode.ToString())
    }

    if ($exitCode -eq 3010 -or $exitCode -eq 3015 -or $exitCode -eq 1641) {
        # Return the required reboot code 3010
        Write-Verbose "Reboot required post test agent installation , return 3010" -Verbose
        return 3010;
    }

    return $exitCode
}

return Install-Product -SetupPath $setupPath -ProductVersion $productVersion -Update $update