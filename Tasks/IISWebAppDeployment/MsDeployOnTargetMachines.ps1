param (
    [string]$WebDeployPackage,
    [string]$WebDeployParamFile,
    [string]$OverRideParams,
    [string]$WebSiteName,
    [string]$AppPoolName,
    [string]$WebSitePhysicalPath,
    [string]$WebSitePhysicalPathAuth,
    [string]$WebSiteAuthUserName,
    [string]$WebSiteAuthUserPassword,
    [string]$AddBinding,
    [string]$Protocol,
    [string]$IpAddress,
    [string]$Port,
    [string]$HostName,
    [string]$ServerNameIndication,
    [string]$SslCertThumbPrint,
    [string]$AppCmdArgs,
    [string]$MethodToInvoke = "Execute-Main"
    )

Write-Verbose "Entering script MsDeployOnTargetMachines.ps1" -Verbose
Write-Verbose "WebDeployPackage = $WebDeployPackage" -Verbose
Write-Verbose "WebDeployParamFile = $WebDeployParamFile" -Verbose
Write-Verbose "OverRideParams = $OverRideParams" -Verbose

Write-Verbose "WebSiteName = $WebSiteName" -Verbose
Write-Verbose "AppPoolName = $AppPoolName" -Verbose
Write-Verbose "WebSitePhysicalPath = $WebSitePhysicalPath" -Verbose
Write-Verbose "WebSitePhysicalPathAuth = $WebSitePhysicalPathAuth" -Verbose
Write-Verbose "WebSiteAuthUserName = $WebSiteAuthUserName" -Verbose
Write-Verbose "WebSiteAuthUserPassword = $WebSiteAuthUserPassword" -Verbose
Write-Verbose "AddBinding = $AddBinding" -Verbose
Write-Verbose "Protocol = $Protocol" -Verbose
Write-Verbose "IpAddress = $IpAddress" -Verbose
Write-Verbose "Port = $Port" -Verbose
Write-Verbose "HostName = $HostName" -Verbose
Write-Verbose "ServerNameIndication = $ServerNameIndication" -Verbose
Write-Verbose "AppCmdArgs = $AppCmdArgs" -Verbose

Write-Verbose "MethodToInvoke = $MethodToInvoke" -Verbose

$AppCmdRegKey = "HKLM:\SOFTWARE\Microsoft\InetStp"
$MsDeployInstallPathRegKey = "HKLM:\SOFTWARE\Microsoft\IIS Extensions\MSDeploy"

function ThrowError
{
    param([string]$errorMessage)

        $readmelink = "http://aka.ms/iiswebappdeployreadme"
        $helpMessage = [string]::Format("For more info please refer to {0}", $readmelink)
        throw "$errorMessage $helpMessage `n"
}

function Run-Command
{
    param(
        [string]$command,
        [bool] $failOnErr = $true
    )

    $ErrorActionPreference = 'Continue'

    if( $psversiontable.PSVersion.Major -le 4)
    {        
        $result = cmd.exe /c "`"$command`""    
    }
    else
    {
        $result = cmd.exe /c "$command"
    }
    
    $ErrorActionPreference = 'Stop'

    if($failOnErr -and $LASTEXITCODE -ne 0)
    {
        ThrowError($result)
    }
    
    return $result
}

function IsInputNullOrEmpty
{
    param(
        [string]$str
    )

    return ([string]::IsNullOrEmpty($str) -or $str -eq "`"`"")
}

function Get-MsDeployLocation
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$regKeyPath
    )

    $msDeployNotFoundError = "Cannot find MsDeploy.exe location. Verify MsDeploy.exe is installed on $env:ComputeName and try operation again."
    
    if( -not (Test-Path -Path $regKeyPath))
    {
        ThrowError -errorMessage $msDeployNotFoundError 
    }
        
    $path = (Get-ChildItem -Path $regKeyPath | Select -Last 1).GetValue("InstallPath")

    if( -not (Test-Path -Path $path))
    {
        ThrowError -errorMessage $msDeployNotFoundError 
    }

    return (Join-Path $path msDeploy.exe)
}

function Get-AppCmdLocation
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$regKeyPath
    )
    
    $appCmdNotFoundError = "Cannot find appcmd.exe location. Verify IIS is configured on $env:ComputerName and try operation again."
    $appCmdMinVersionError = "Version of IIS is less than 7.0 on machine $env:ComputerName. Minimum version of IIS required is 7.0"
    
    
    if(-not (Test-Path -Path $regKeyPath))
    {
        ThrowError -errorMessage $appCmdNotFoundError
    }

    $regKey = Get-ItemProperty -Path $regKeyPath
    $path = $regKey.InstallPath
    $version = $regKey.MajorVersion
        
    if($version -le 6.0)
    {
        ThrowError -errorMessage $appCmdMinVersionError
    }
        
    if( -not (Test-Path $path))
    {
        ThrowError -errorMessage $appCmdNotFoundError
    }
    

    return (Join-Path $path appcmd.exe), $version
}

function Get-MsDeployCmdArgs
{
    param(
    [Parameter(Mandatory=$true)]
    [string]$webDeployPackage,
    [string]$webDeployParamFile,
    [string]$overRideParams
    )
    
    $webDeployPackage = $webDeployPackage.Trim('"')
    $webDeployParamFile = $webDeployParamFile.Trim('"')
    $overRideParams = $overRideParams.Trim('"').Replace('''', '"')
    
    if(-not ( Test-Path -Path $webDeployPackage))
    {
        ThrowError -errorMessage "Package does not exist : $webDeployPackage"
    }

    $msDeployCmdArgs = [string]::Empty
    if(-not (IsInputNullOrEmpty -str $webDeployParamFile))
    {   
    
        if(-not ( Test-Path -Path $webDeployParamFile))
        {
            ThrowError -errorMessage "Param file does not exist : $webDeployParamFile"
        } 

        $msDeployCmdArgs = [string]::Format(' -setParamFile="{0}"', $webDeployParamFile)
    }

    if(-not (IsInputNullOrEmpty -str $overRideParams))
    {
        $msDeployCmdArgs = [string]::Format('{0} -setParam:{1}', $msDeployCmdArgs, $overRideParams)
    }
    
    $msDeployCmdArgs = [string]::Format(' -verb:sync -source:package="{0}" {1} -dest:auto -verbose -retryAttempts:3 -retryInterval:3000', $webDeployPackage, $msDeployCmdArgs)
    return $msDeployCmdArgs
}

function Does-WebSiteExists
{
    param([string] $siteName)

    $appCmdPath, $iisVerision = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' list site /name:{0}',$siteName)
    $command = "`"$appCmdPath`" $appCmdArgs"
    Write-Verbose "Checking webSite exists. Running Command : $command"
    
    $webSite = Run-Command -command $command -failOnErr $false
    
    if($webSite -ne $null)
    {
        Write-Verbose "WebSite already exists" -Verbose
        return $true
    }
    
    Write-Verbose "WebSite does not exist" -Verbose
    return $false
}

function Does-BindingExists
{
    param(
        [string]$siteName,
        [string]$protocol,
        [string]$ipAddress,
        [string]$port,
        [string]$hostname
    )
    
    $appCmdPath, $iisVerision = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' list site /name:{0}',$siteName)
    $command = "`"$appCmdPath`" $appCmdArgs"

    Write-Verbose "Checking binding exists for website $siteName. Running Command : $command" -Verbose
    
    $webSite = Run-Command -command $command -failOnErr $false    
    $binding = [string]::Format("{0}/{1}:{2}:{3}", $protocol, $ipAddress, $port, $hostname)
    
    if($webSite.Contains($binding))
    {
        Write-Verbose "Binding already exists for website $siteName" -Verbose
        return $true
    }
    
    Write-Verbose "Binding does not exists for website $siteName" -Verbose
    return $false
}

function Enable-SNI
{
    param(
        [string]$siteName,
        [string]$sni,
        [string]$ipAddress,
        [string]$port,
        [string]$hostname
    )

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey

    if( -not ($sni -eq "true" -and $iisVersion -ge 8 -and -not (IsInputNullOrEmpty -str $hostname)))
    {
        Write-Verbose "Not Enabling SNI : sni : $sni, iisVersion : $iisVersion, hostname : $hostname. Possible Reasons: `n 1. IIS Version is less than 8 `n 2. HostName input is not provided `n 3. SNI input is set to false" -Verbose
        return
    }
    
    if($ipAddress -eq "`"All Unassigned`"")
    {
        $ipAddress = "*"
    }

    $appCmdArgs = [string]::Format(' set site /site.name:{0} /bindings.[protocol=''https'',bindingInformation=''{1}:{2}:{3}''].sslFlags:"1"',$siteName, $ipAddress, $port, $hostname)

    $command = "`"$appCmdPath`" $appCmdArgs"       
    
    Write-Verbose "Enabling SNI by setting SslFlags=1 for binding. Running Command : $command" -Verbose
    Run-Command -command $command
}

function Add-SslCert
{
    param(
        [string]$port,
        [string]$certhash,
        [string]$hostname,
        [string]$sni,
        [string]$iisVersion
    )

    if(IsInputNullOrEmpty -str $certhash)
    {
        Write-Verbose "CertHash is empty .. returning" -Verbose
        return
    }

    $result = $null
    $isItSameBinding = $false
    $addCertCmd = [string]::Empty

    #SNI is supported IIS 8 and above. To enable SNI hostnameport option should be used
    if($sni -eq "true" -and $iisVersion -ge 8 -and (-not (IsInputNullOrEmpty -str $hostname)))
    {
        $showCertCmd = [string]::Format("netsh http show sslcert hostnameport={0}:{1}", $hostname, $port)
        Write-Verbose "Checking SslCert binding already Present. Running Command : $showCertCmd" -Verbose
        
        $result = Run-Command -command $showCertCmd -failOnErr $false
        $isItSameBinding = $result.Get(4).Contains([string]::Format("{0}:{1}", $hostname, $port))

        $addCertCmd = [string]::Format("netsh http add sslcert hostnameport={0}:{1} certhash={2} appid={{{3}}} certstorename=MY", $hostname, $port, $certhash, [System.Guid]::NewGuid().toString())
    }
    else
    {
        $showCertCmd = [string]::Format("netsh http show sslcert ipport=0.0.0.0:{0}", $port)
        Write-Verbose "Checking SslCert binding already Present. Running Command : $showCertCmd" -Verbose
        
        $result = Run-Command -command $showCertCmd -failOnErr $false
        $isItSameBinding = $result.Get(4).Contains([string]::Format("0.0.0.0:{0}", $port))
        
        $addCertCmd = [string]::Format("netsh http add sslcert ipport=0.0.0.0:{0} certhash={1} appid={{{2}}}", $port, $certhash, [System.Guid]::NewGuid().toString())
    }

    $isItSameCert = $result.Get(5).Contains([string]::Format("{0}", $certhash))

    if($isItSameBinding -and $isItSameCert)
    {
        Write-Verbose "SSL cert binding already present.. returning" -Verbose
        return
    }
        
    Write-Verbose "Setting SslCert for WebSite." -Verbose               
    Run-Command -command $addCertCmd
}

function Deploy-WebSite
{    
    param(
        [string]$webDeployPkg,
        [string]$webDeployParamFile,
        [string]$overRiderParams
    )

    $msDeployExePath = Get-MsDeployLocation -regKeyPath $MsDeployInstallPathRegKey
    $msDeployCmdArgs = Get-MsDeployCmdArgs -webDeployPackage $webDeployPkg -webDeployParamFile $webDeployParamFile -overRideParams $overRiderParams

    $msDeployCmd = "`"$msDeployExePath`" $msDeployCmdArgs"
    Write-Verbose "Deploying WebSite. Running Command: $msDeployCmd" -Verbose
    Run-Command -command $msDeployCmd
}

function Create-WebSite
{
    param(
    [string]$siteName,
    [string]$physicalPath
    )

    $appCmdPath, $iisVerision = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' add site /name:{0} /physicalPath:{1}',$siteName, $physicalPath)
    $command = "`"$appCmdPath`" $appCmdArgs"       
    
    Write-Verbose "Creating WebSite. Running Command : $command" -Verbose
    Run-Command -command $command
}

function Run-AdditionalCommands
{
    param(
        [string]$additionalArgs
    )

    $additionalArgs = $additionalArgs.Trim('"')
    if(IsInputNullOrEmpty -str $additionalArgs)
    {
        Write-Verbose "No additional commands to run returning" -Verbose
        return
    }
    
    $appCmdPath, $iisVerision = Get-AppCmdLocation -regKeyPath $AppCmdRegKey    
    $command = "`"$appCmdPath`" $additionalArgs"

    Write-Verbose "Running additional commands. $command" -Verbose
    Run-Command -command $command
}

function Update-WebSite
{
    param(
        [string]$siteName,
        [string]$appPoolName,
        [string]$physicalPath,
        [string]$authType,
        [string]$userName,
        [string]$password,
        [string]$addBinding,
        [string]$protocol,
        [string]$ipAddress,
        [string]$port,
        [string]$hostname        
    )

    $appCmdArgs = [string]::Format(' set site /site.name:{0}', $siteName)

    if(-not (IsInputNullOrEmpty -str $appPoolName))
    {    
        $appCmdArgs = [string]::Format('{0} -applicationDefaults.applicationPool:{1}', $appCmdArgs, $appPoolName)
    }

    if(-not (IsInputNullOrEmpty -str $physicalPath))
    {
        $appCmdArgs = [string]::Format("{0} -[path='/'].[path='/'].physicalPath:{1}", $appCmdArgs, $physicalPath)
    }

    if(-not (IsInputNullOrEmpty -str $userName) -and $authType -eq "WebSiteWindowsAuth")
    {
        $appCmdArgs = [string]::Format("{0} -[path='/'].[path='/'].userName:{1}", $appCmdArgs, $userName)
    }

    if(-not (IsInputNullOrEmpty -str $password) -and $authType -eq "WebSiteWindowsAuth")
    {
        $appCmdArgs = [string]::Format("{0} -[path='/'].[path='/'].password:{1}", $appCmdArgs, $password)
    }

    if($ipAddress -eq "`"All Unassigned`"")
    {
        $ipAddress = "*"
    }

    $isBindingExists = Does-BindingExists -siteName $siteName -protocol $protocol -ipAddress $ipAddress -port $port -hostname $hostname

    if($addBinding -eq "true" -and $isBindingExists -eq $false)
    {
        $appCmdArgs = [string]::Format("{0} /+bindings.[protocol='{1}',bindingInformation='{2}:{3}:{4}']", $appCmdArgs, $protocol, $ipAddress, $port, $hostname)
    }
        
    $appCmdPath, $iisVerision = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $command = "`"$appCmdPath`" $appCmdArgs"
    
    Write-Verbose "Updating WebSite Properties. Running Command : $command" -Verbose
    Run-Command -command $command 
}

function Create-And-Update-WebSite
{
    param(
        [string]$siteName,
        [string]$appPoolName,
        [string]$physicalPath,
        [string]$authType,
        [string]$userName,
        [string]$password,
        [string]$addBinding,
        [string]$protocol,
        [string]$ipAddress,
        [string]$port,
        [string]$hostname
    )

    $doesWebSiteExists = Does-WebSiteExists -siteName $siteName
    
    if( -not $doesWebSiteExists)
    {
        Create-WebSite -siteName $siteName -physicalPath $physicalPath
    }

    Update-WebSite -siteName $siteName -appPoolName $appPoolName -physicalPath $physicalPath -authType $authType -userName $userName -password $password `
    -addBinding $addBinding -protocol $protocol -ipAddress $ipAddress -port $port -hostname $hostname
}

function Execute-Main
{
    Write-Verbose "Entering Execute-Main function" -Verbose

    if(-not (IsInputNullOrEmpty -str $WebSiteName))
    {
        Create-And-Update-WebSite -siteName $WebSiteName -appPoolName $AppPoolName -physicalPath $WebSitePhysicalPath -authType $WebSitePhysicalPathAuth -userName $WebSiteAuthUserName `
         -password $WebSiteAuthUserPassword -addBinding $AddBinding -protocol $Protocol -ipAddress $IpAddress -port $Port -hostname $HostName

        if($Protocol -eq "https")
        {
            $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
            Add-SslCert -port $Port -certhash $SslCertThumbPrint -hostname $HostName -sni $ServerNameIndication -iisVersion $iisVersion
            Enable-SNI -siteName $WebSiteName -sni $ServerNameIndication -ipAddress $IpAddress -port $Port -hostname $HostName
        }

        Run-AdditionalCommands -additionalArgs $AppCmdArgs
    }

    Deploy-WebSite -webDeployPkg $WebDeployPackage -webDeployParamFile $WebDeployParamFile -overRiderParams $OverRideParams

    Write-Verbose "Exiting Execute-Main function" -Verbose
}

Invoke-Expression $MethodToInvoke
