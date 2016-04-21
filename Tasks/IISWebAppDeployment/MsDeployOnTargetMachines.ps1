Write-Verbose "Entering script MsDeployOnTargetMachines.ps1"
$AppCmdRegKey = "HKLM:\SOFTWARE\Microsoft\InetStp"
$MsDeployInstallPathRegKey = "HKLM:\SOFTWARE\Microsoft\IIS Extensions\MSDeploy"

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
        throw $result
    }
    
    return $result
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
        throw $msDeployNotFoundError 
    }
        
    $path = (Get-ChildItem -Path $regKeyPath | Select -Last 1).GetValue("InstallPath")

    if( -not (Test-Path -Path $path))
    {
        throw $msDeployNotFoundError 
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
        throw $appCmdNotFoundError
    }

    $regKey = Get-ItemProperty -Path $regKeyPath
    $path = $regKey.InstallPath
    $version = $regKey.MajorVersion
        
    if($version -le 6.0)
    {
        throw $appCmdMinVersionError
    }

    if( -not (Test-Path $path))
    {
        throw $appCmdNotFoundError
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

    if(-not ( Test-Path -Path $webDeployPackage))
    {
        throw "Package does not exist : `"$webDeployPackage`""
    }

    $msDeployCmdArgs = [string]::Empty
    if(-not [string]::IsNullOrWhiteSpace($webDeployParamFile))
    {   
    
        if(-not ( Test-Path -Path $webDeployParamFile))
        {
            throw "Param file does not exist : `"$webDeployParamFile`""
        }

        $msDeployCmdArgs = [string]::Format(' -setParamFile="{0}"', $webDeployParamFile)
    }
    
    $setParams = $overRideParams.Split([System.Environment]::NewLine, [System.StringSplitOptions]::RemoveEmptyEntries)
    foreach($setParam in $setParams)
    {
        $setParam = $setParam.Trim()
        if(-not [string]::IsNullOrWhiteSpace($setParam))
        {
            $msDeployCmdArgs = [string]::Format('{0} -setParam:{1}', $msDeployCmdArgs, $setParam)
        }
    }
    
    $msDeployCmdArgs = [string]::Format(' -verb:sync -source:package="{0}" {1} -dest:auto -verbose -retryAttempts:3 -retryInterval:3000', $webDeployPackage, $msDeployCmdArgs)
    return $msDeployCmdArgs
}

function Does-WebSiteExists
{
    param([string] $siteName)

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' list site /name:"{0}"',$siteName)
    $command = "`"$appCmdPath`" $appCmdArgs"
    Write-Verbose "Checking website exists. Running command : $command"

    $website = Run-Command -command $command -failOnErr $false

    if($website -ne $null)
    {
        Write-Verbose "Website (`"$siteName`") already exists"
        return $true
    }

    Write-Verbose "Website (`"$siteName`") does not exist"
    return $false
}

function Does-BindingExists
{
    param(
        [string]$siteName,
        [string]$protocol,
        [string]$ipAddress,
        [string]$port,
        [string]$hostname,
        [string]$assignDupBindings
    )

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' list sites')
    $command = "`"$appCmdPath`" $appCmdArgs"

    Write-Verbose "Checking binding exists for website (`"$siteName`"). Running command : $command"

    $sites = Run-Command -command $command -failOnErr $false
    $binding = [string]::Format("{0}/{1}:{2}:{3}", $protocol, $ipAddress, $port, $hostname)

    $isBindingExists = $false

    foreach($site in $sites)
    {
        switch($assignDupBindings)
        {
            $true
            {
                if($site.Contains($siteName) -and $site.Contains($binding))
                {
                    $isBindingExists = $true
                }
            }
            default
            {
                if($site.Contains($siteName) -and $site.Contains($binding))
                {
                    $isBindingExists = $true
                }
                elseif($site.Contains($binding))
                {
                    throw "Binding already exists for website (`"$site`")"
                }
            }
        }
    }

    Write-Verbose "Does bindings exist for website (`"$siteName`") is : $isBindingExists"
    return $isBindingExists
}

function Does-AppPoolExists
{  
    param(
        [string]$appPoolName
    )

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' list apppool /name:"{0}"',$appPoolName)
    $command = "`"$appCmdPath`" $appCmdArgs"

    Write-Verbose "Checking application exists. Running command : $command"

    $appPool = Run-Command -command $command -failOnErr $false

    if($appPool -ne $null)
    {
        Write-Verbose "Application Pool (`"$appPoolName`") already exists"
        return $true
    }

    Write-Verbose "Application Pool (`"$appPoolName`") does not exists"
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

    if( -not ($sni -eq "true" -and $iisVersion -ge 8 -and -not [string]::IsNullOrWhiteSpace($hostname)))
    {
        Write-Verbose "Not enabling SNI : sni : $sni, iisVersion : $iisVersion, hostname : $hostname. Possible Reasons: `n 1. IIS Version is less than 8 `n 2. HostName input is not provided `n 3. SNI input is set to false"
        return
    }

    if($ipAddress -eq "All Unassigned")
    {
        $ipAddress = "*"
    }

    $appCmdArgs = [string]::Format(' set site /site.name:{0} /bindings.[protocol=''https'',bindingInformation=''{1}:{2}:{3}''].sslFlags:"1"',$siteName, $ipAddress, $port, $hostname)
    $command = "`"$appCmdPath`" $appCmdArgs"

    Write-Verbose "Enabling SNI by setting SslFlags=1 for binding. Running command : $command"
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

    if([string]::IsNullOrWhiteSpace($certhash))
    {
        Write-Verbose "CertHash is empty .. returning"
        return
    }

    $result = $null
    $isItSameBinding = $false
    $addCertCmd = [string]::Empty

    #SNI is supported IIS 8 and above. To enable SNI hostnameport option should be used
    if($sni -eq "true" -and $iisVersion -ge 8 -and -not [string]::IsNullOrWhiteSpace($hostname))
    {
        $showCertCmd = [string]::Format("netsh http show sslcert hostnameport={0}:{1}", $hostname, $port)
        Write-Verbose "Checking SslCert binding already Present. Running command : $showCertCmd"

        $result = Run-Command -command $showCertCmd -failOnErr $false
        $isItSameBinding = $result.Get(4).Contains([string]::Format("{0}:{1}", $hostname, $port))

        $addCertCmd = [string]::Format("netsh http add sslcert hostnameport={0}:{1} certhash={2} appid={{{3}}} certstorename=MY", $hostname, $port, $certhash, [System.Guid]::NewGuid().toString())
    }
    else
    {
        $showCertCmd = [string]::Format("netsh http show sslcert ipport=0.0.0.0:{0}", $port)
        Write-Verbose "Checking SslCert binding already Present. Running command : $showCertCmd"

        $result = Run-Command -command $showCertCmd -failOnErr $false
        $isItSameBinding = $result.Get(4).Contains([string]::Format("0.0.0.0:{0}", $port))
        
        $addCertCmd = [string]::Format("netsh http add sslcert ipport=0.0.0.0:{0} certhash={1} appid={{{2}}}", $port, $certhash, [System.Guid]::NewGuid().toString())
    }

    $isItSameCert = $result.Get(5).ToLower().Contains([string]::Format("{0}", $certhash.ToLower()))

    if($isItSameBinding -and $isItSameCert)
    {
        Write-Verbose "SSL cert binding already present.. returning"
        return
    }

    Write-Verbose "Setting SslCert for website."
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
    Write-Verbose "Deploying website. Running command: $msDeployCmd"
    Run-Command -command $msDeployCmd
}

function Create-WebSite
{
    param(
    [string]$siteName,
    [string]$physicalPath
    )

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' add site /name:"{0}" /physicalPath:"{1}"',$siteName, $physicalPath)
    $command = "`"$appCmdPath`" $appCmdArgs"

    Write-Verbose "Creating website. Running command : $command"
    Run-Command -command $command
}

function Create-AppPool
{
    param(
        [string]$appPoolName
    )

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $appCmdArgs = [string]::Format(' add apppool /name:"{0}"', $appPoolName)
    $command = "`"$appCmdPath`" $appCmdArgs"

    Write-Verbose "Creating application Pool. Running command : $command"
    Run-Command -command $command
}

function Run-AdditionalCommands
{
    param(
        [string]$additionalCommands
    )

    $appCmdCommands = $additionalCommands.Trim('"').Split([System.Environment]::NewLine, [System.StringSplitOptions]::RemoveEmptyEntries)
    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey

    foreach($appCmdCommand in $appCmdCommands)
    {
        if(-not [string]::IsNullOrWhiteSpace($appCmdCommand.Trim(' ')))
        {
            $command = "`"$appCmdPath`" $appCmdCommand"

            Write-Verbose "Running additional command. $command"
            Run-Command -command $command
        }
    }
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
        [string]$hostname,
        [string]$assignDupBindings
    )

    $appCmdArgs = [string]::Format(' set site /site.name:"{0}"', $siteName)

    if(-not [string]::IsNullOrWhiteSpace($appPoolName))
    {
        $appCmdArgs = [string]::Format('{0} -applicationDefaults.applicationPool:"{1}"', $appCmdArgs, $appPoolName)
    }

    if(-not [string]::IsNullOrWhiteSpace($physicalPath))
    {
        $appCmdArgs = [string]::Format("{0} -[path='/'].[path='/'].physicalPath:`"{1}`"", $appCmdArgs, $physicalPath)
    }

    if(-not [string]::IsNullOrWhiteSpace($userName) -and $authType -eq "WebsiteWindowsAuth")
    {
        $appCmdArgs = [string]::Format("{0} -[path='/'].[path='/'].userName:{1}", $appCmdArgs, $userName)
    }

    if(-not [string]::IsNullOrWhiteSpace($password) -and $authType -eq "WebsiteWindowsAuth")
    {
        $appCmdArgs = [string]::Format("{0} -[path='/'].[path='/'].password:{1}", $appCmdArgs, $password)
    }

    if($ipAddress -eq "All Unassigned")
    {
        $ipAddress = "*"
    }

    $isBindingExists = Does-BindingExists -siteName $siteName -protocol $protocol -ipAddress $ipAddress -port $port -hostname $hostname -assignDupBindings $assignDupBindings

    if($addBinding -eq "true" -and $isBindingExists -eq $false)
    {
        $appCmdArgs = [string]::Format("{0} /+bindings.[protocol='{1}',bindingInformation='{2}:{3}:{4}']", $appCmdArgs, $protocol, $ipAddress, $port, $hostname)
    }

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $command = "`"$appCmdPath`" $appCmdArgs"

    Write-Verbose "Updating website properties. Running command : $command"
    Run-Command -command $command
}

function Update-AppPool
{
    param(
        [string]$appPoolName,
        [string]$clrVersion,
        [string]$pipeLineMode,
        [string]$identity,
        [string]$userName,
        [string]$password
    )

    $appCmdArgs = ' set config  -section:system.applicationHost/applicationPools'

    if(-not [string]::IsNullOrWhiteSpace($clrVersion))
    {
        $appCmdArgs = [string]::Format('{0} /[name=''"{1}"''].managedRuntimeVersion:{2}', $appCmdArgs, $appPoolName, $clrVersion)
    }

    if(-not [string]::IsNullOrWhiteSpace($pipeLineMode))
    {
        $appCmdArgs = [string]::Format('{0} /[name=''"{1}"''].managedPipelineMode:{2}', $appCmdArgs, $appPoolName, $pipeLineMode)
    }

    if($identity -eq "SpecificUser" -and -not [string]::IsNullOrWhiteSpace($userName) -and -not [string]::IsNullOrWhiteSpace($password))
    {
        $appCmdArgs = [string]::Format('{0} /[name=''"{1}"''].processModel.identityType:SpecificUser /[name=''"{1}"''].processModel.userName:"{2}" /[name=''"{1}"''].processModel.password:"{3}"',`
                                $appCmdArgs, $appPoolName, $userName, $password)
    }
    else
    {
        $appCmdArgs = [string]::Format('{0} /[name=''"{1}"''].processModel.identityType:{2}', $appCmdArgs, $appPoolName, $identity)
    }

    $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
    $command = "`"$appCmdPath`" $appCmdArgs"

    Write-Verbose "Updating application pool properties. Running command : $command"
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
        [string]$hostname,
        [string]$assignDupBindings
    )

    $doesWebSiteExists = Does-WebSiteExists -siteName $siteName
    
    if( -not $doesWebSiteExists)
    {
        Create-WebSite -siteName $siteName -physicalPath $physicalPath
    }

    Update-WebSite -siteName $siteName -appPoolName $appPoolName -physicalPath $physicalPath -authType $authType -userName $userName -password $password `
    -addBinding $addBinding -protocol $protocol -ipAddress $ipAddress -port $port -hostname $hostname -assignDupBindings $assignDupBindings
}

function Create-And-Update-AppPool
{
    param(
        [string]$appPoolName,
        [string]$clrVersion,
        [string]$pipeLineMode,
        [string]$identity,
        [string]$userName,
        [string]$password
    )

    $doesAppPoolExists = Does-AppPoolExists -appPoolName $appPoolName

    if(-not $doesAppPoolExists)
    {
        Create-AppPool -appPoolName $appPoolName
    }

    Update-AppPool -appPoolName $appPoolName -clrVersion $clrVersion -pipeLineMode $pipeLineMode -identity $identity -userName $userName -password $password
}

function Execute-Main
{
    param (
        [string]$WebDeployPackage,
        [string]$WebDeployParamFile,
        [string]$OverRideParams,
        [string]$CreateWebSite,
        [string]$WebSiteName,
        [string]$WebSitePhysicalPath,
        [string]$WebSitePhysicalPathAuth,
        [string]$WebSiteAuthUserName,
        [string]$WebSiteAuthUserPassword,
        [string]$AddBinding,
        [string]$AssignDuplicateBinding,
        [string]$Protocol,
        [string]$IpAddress,
        [string]$Port,
        [string]$HostName,
        [string]$ServerNameIndication,
        [string]$SslCertThumbPrint,
        [string]$CreateAppPool,
        [string]$AppPoolName,
        [string]$DotNetVersion,
        [string]$PipeLineMode,
        [string]$AppPoolIdentity,
        [string]$AppPoolUsername,
        [string]$AppPoolPassword,
        [string]$AppCmdCommands
        )

    Write-Verbose "Entering Execute-Main function"
    Write-Verbose "WebDeployPackage = $WebDeployPackage"
    Write-Verbose "WebDeployParamFile = $WebDeployParamFile"
    Write-Verbose "OverRideParams = $OverRideParams"

    Write-Verbose "CreateWebSite= $CreateWebSite"
    Write-Verbose "WebSiteName = $WebSiteName"
    Write-Verbose "WebSitePhysicalPath = $WebSitePhysicalPath"
    Write-Verbose "WebSitePhysicalPathAuth = $WebSitePhysicalPathAuth"
    Write-Verbose "WebSiteAuthUserName = $WebSiteAuthUserName"
    Write-Verbose "WebSiteAuthUserPassword = $WebSiteAuthUserPassword"
    Write-Verbose "AddBinding = $AddBinding"
    Write-Verbose "AssignDuplicateBinding = $AssignDuplicateBinding"
    Write-Verbose "Protocol = $Protocol"
    Write-Verbose "IpAddress = $IpAddress"
    Write-Verbose "Port = $Port"
    Write-Verbose "HostName = $HostName"
    Write-Verbose "ServerNameIndication = $ServerNameIndication"

    Write-Verbose "CreateAppPool = $CreateAppPool"
    Write-Verbose "AppPoolName = $AppPoolName"
    Write-Verbose "DotNetVersion = $DotNetVersion"
    Write-Verbose "PipeLineMode = $PipeLineMode"
    Write-Verbose "AppPoolIdentity = $AppPoolIdentity"
    Write-Verbose "AppPoolUsername = $AppPoolUsername"
    Write-Verbose "AppPoolPassword = $AppPoolPassword"
    Write-Verbose "AppCmdCommands = $AppCmdCommands"
    
    if($CreateAppPool -ieq "true")
    {
        Create-And-Update-AppPool -appPoolName $AppPoolName -clrVersion $DotNetVersion -pipeLineMode $PipeLineMode -identity $AppPoolIdentity -userName $AppPoolUsername -password $AppPoolPassword
    }

    if($CreateWebSite -ieq "true")
    {
        Create-And-Update-WebSite -siteName $WebSiteName -appPoolName $AppPoolName -physicalPath $WebSitePhysicalPath -authType $WebSitePhysicalPathAuth -userName $WebSiteAuthUserName `
         -password $WebSiteAuthUserPassword -addBinding $AddBinding -protocol $Protocol -ipAddress $IpAddress -port $Port -hostname $HostName -assignDupBindings $AssignDuplicateBinding

        if($Protocol -eq "https")
        {
            $appCmdPath, $iisVersion = Get-AppCmdLocation -regKeyPath $AppCmdRegKey
            Add-SslCert -port $Port -certhash $SslCertThumbPrint -hostname $HostName -sni $ServerNameIndication -iisVersion $iisVersion
            Enable-SNI -siteName $WebSiteName -sni $ServerNameIndication -ipAddress $IpAddress -port $Port -hostname $HostName
        }
    }
    else
    {
        $doesWebSiteExists = Does-WebSiteExists -siteName $WebSiteName
        if (-not $doesWebSiteExists)  
        {
            Write-Verbose "Website does not exist and you did not request to create it - deployment might fail."  
        }
    }

    Run-AdditionalCommands -additionalCommands $AppCmdCommands

    Deploy-WebSite -webDeployPkg $WebDeployPackage -webDeployParamFile $WebDeployParamFile -overRiderParams $OverRideParams

    Write-Verbose "Exiting Execute-Main function"
}
