[String] $Architecture = ""
[String] $Version = ""
[String] $PythonExecName = ""

function Get-RegistryVersionFilter {
    param(
        [Parameter(Mandatory)][String] $Architecture,
        [Parameter(Mandatory)][Int32] $MajorVersion,
        [Parameter(Mandatory)][Int32] $MinorVersion
    )

    $archFilter = if ($Architecture -eq 'x86') { "32-bit" } else { "64-bit" }
    ### Python 2.7 x86 have no architecture postfix
    if (($Architecture -eq "x86") -and ($MajorVersion -eq 2)) {
        "Python $MajorVersion.$MinorVersion.\d+$"
    } else {
        "Python $MajorVersion.$MinorVersion.*($archFilter)"
    }
}

function Remove-RegistryEntries {
    param(
        [Parameter(Mandatory)][String] $Architecture,
        [Parameter(Mandatory)][Int32] $MajorVersion,
        [Parameter(Mandatory)][Int32] $MinorVersion
    )

    $versionFilter = Get-RegistryVersionFilter -Architecture $Architecture -MajorVersion $MajorVersion -MinorVersion $MinorVersion

    $regPath = "HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Installer\UserData\S-1-5-18\Products"
    if (Test-Path -Path Registry::$regPath) {
        $regKeys = Get-ChildItem -Path Registry::$regPath -Recurse | Where-Object Property -Ccontains DisplayName
        foreach ($key in $regKeys) {
            if ($key.getValue("DisplayName") -match $versionFilter) {
                Remove-Item -Path $key.PSParentPath -Recurse -Force -Verbose
            }
        }
    }

    $regPath = "HKEY_CLASSES_ROOT\Installer\Products"
    if (Test-Path -Path Registry::$regPath) {
        Get-ChildItem -Path Registry::$regPath | Where-Object { $_.GetValue("ProductName") -match $versionFilter } | ForEach-Object {
            Remove-Item Registry::$_ -Recurse -Force -Verbose
        }
    }

    $uninstallRegistrySections = @(
        "HKEY_CURRENT_USER\Software\Microsoft\Windows\CurrentVersion\Uninstall",  # current user, x64
        "HKEY_LOCAL_MACHINE\Software\Microsoft\Windows\CurrentVersion\Uninstall", # all users, x64
        "HKEY_CURRENT_USER\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall",  # current user, x86
        "HKEY_LOCAL_MACHINE\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"  # all users, x86
    )

    $uninstallRegistrySections | Where-Object { Test-Path -Path Registry::$_ } | ForEach-Object {
        Get-ChildItem -Path Registry::$_ | Where-Object { $_.getValue("DisplayName") -match $versionFilter } | ForEach-Object {
            Remove-Item Registry::$_ -Recurse -Force -Verbose
        }
    }
}

function Get-ExecParams {
    param(
        [Parameter(Mandatory)][Boolean] $IsMSI,
        [Parameter(Mandatory)][String] $PythonArchPath
    )

    if ($IsMSI) {
        "TARGETDIR=$PythonArchPath ALLUSERS=1"
    } else {
        "DefaultAllUsersTargetDir=$PythonArchPath InstallAllUsers=1"
    }
}

$ToolcacheRoot = $env:AGENT_TOOLSDIRECTORY
if ([string]::IsNullOrEmpty($ToolcacheRoot)) {
    # GitHub images don't have `AGENT_TOOLSDIRECTORY` variable
    $ToolcacheRoot = $env:RUNNER_TOOL_CACHE
}
$PythonToolcachePath = Join-Path -Path $ToolcacheRoot -ChildPath "Python"
$PythonVersionPath = Join-Path -Path $PythonToolcachePath -ChildPath $Version
$PythonArchPath = Join-Path -Path $PythonVersionPath -ChildPath $Architecture

$IsMSI = $PythonExecName -match "msi"

$MajorVersion = $Version.Split('.')[0]
$MinorVersion = $Version.Split('.')[1]

Write-Host "Check if Python hostedtoolcache folder exist..."
if (-Not (Test-Path $PythonToolcachePath)) {
    Write-Host "Create Python toolcache folder"
    New-Item -ItemType Directory -Path $PythonToolcachePath | Out-Null
}

Write-Host "Check if current Python version is installed..."
$InstalledVersions = Get-Item "$PythonToolcachePath\$MajorVersion.$MinorVersion.*\$Architecture"

if ($null -ne $InstalledVersions) {
    Write-Host "Python$MajorVersion.$MinorVersion ($Architecture) was found in $PythonToolcachePath..."

    foreach ($InstalledVersion in $InstalledVersions) {
        if (Test-Path -Path $InstalledVersion) {
            Write-Host "Deleting $InstalledVersion..."
            Remove-Item -Path $InstalledVersion -Recurse -Force
            if (Test-Path -Path "$($InstalledVersion.Parent.FullName)/${Architecture}.complete") {
                Remove-Item -Path "$($InstalledVersion.Parent.FullName)/${Architecture}.complete" -Force -Verbose
            }
        }
    }
} else {
    Write-Host "No Python$MajorVersion.$MinorVersion.* found"
}

Write-Host "Remove registry entries for Python ${MajorVersion}.${MinorVersion}(${Architecture})..."
Remove-RegistryEntries -Architecture $Architecture -MajorVersion $MajorVersion -MinorVersion $MinorVersion

Write-Host "Create Python $Version folder in $PythonToolcachePath"
New-Item -ItemType Directory -Path $PythonArchPath -Force | Out-Null

Write-Host "Copy Python binaries to $PythonArchPath"
Copy-Item -Path ./$PythonExecName -Destination $PythonArchPath | Out-Null

Write-Host "Install Python $Version in $PythonToolcachePath..."
$ExecParams = Get-ExecParams -IsMSI $IsMSI -PythonArchPath $PythonArchPath

cmd.exe /c "cd $PythonArchPath && call $PythonExecName $ExecParams /quiet"
if ($LASTEXITCODE -ne 0) {
    Throw "Error happened during Python installation"
}

Write-Host "Create `python3` symlink"
if ($MajorVersion -ne "2") {
    New-Item -Path "$PythonArchPath\python3.exe" -ItemType SymbolicLink -Value "$PythonArchPath\python.exe"
}

Write-Host "Install and upgrade Pip"
$Env:PIP_ROOT_USER_ACTION = "ignore"
$PythonExePath = Join-Path -Path $PythonArchPath -ChildPath "python.exe"
cmd.exe /c "$PythonExePath -m ensurepip && $PythonExePath -m pip install --upgrade --force-reinstall pip --no-warn-script-location"
if ($LASTEXITCODE -ne 0) {
    Throw "Error happened during pip installation / upgrade"
}

Write-Host "Create complete file"
New-Item -ItemType File -Path $PythonVersionPath -Name "$Architecture.complete" | Out-Null

